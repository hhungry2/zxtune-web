/**
 *
 * @file
 *
 * @brief Emscripten bindings implementation
 *
 **/

#include "analysis/path.h"
#include "binary/container_factories.h"
#include "core/data_location.h"
#include "core/plugin.h"
#include "core/service.h"
#include "formats/chiptune/aym/ym.h"
#include "formats/chiptune/builder_meta.h"
#include "module/additional_files.h"
#include "module/attributes.h"
#include "module/holder.h"
#include "module/players/aym/aym_base.h"
#include "module/players/pipeline.h"
#include "parameters/container.h"
#include "parameters/merged_accessor.h"
#include "sound/chunk.h"
#include "sound/impl/fft_analyzer.h"
#include "sound/sample.h"

#include "error.h"
#include "string_view.h"

#include <emscripten/bind.h>

#include <algorithm>
#include <cstring>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>

namespace
{
  static_assert(Sound::Sample::CHANNELS == 2, "Incompatible sound channels count");
  static_assert(Sound::Sample::BITS == 16, "Incompatible sound sample bits count");

  using TimeBase = Time::Millisecond;

  Parameters::Container::Ptr GlobalOptions()
  {
    static const auto instance = Parameters::Container::Create();
    return instance;
  }

  const ZXTune::Service& Service()
  {
    static const auto instance = ZXTune::Service::Create(GlobalOptions());
    return *instance;
  }

  // embind surfaces std::exception via Module.getExceptionMessage(e)
  [[noreturn]] void Rethrow(const Error& e)
  {
    throw std::runtime_error(e.GetText());
  }

  //! Contract violations deep in the parsers arrive as a bare std::exception, which
  //! reaches javascript as an opaque WebAssembly.Exception. Give it a message instead.
  [[noreturn]] void RethrowMalformed()
  {
    throw std::runtime_error("unsupported or malformed content");
  }

  //! Core failures can surface long after the call that caused them- an xsf holder
  //! resolves its libraries on first use, so a missing one throws out of getProperty
  //! rather than out of load. Anything that can reach core code goes through here,
  //! otherwise the raw Error crosses embind and javascript sees WebAssembly.Exception
  //! with nothing readable on it.
  template<class Fun>
  auto Guarded(Fun&& fun) -> decltype(fun())
  {
    try
    {
      return fun();
    }
    catch (const Error& e)
    {
      Rethrow(e);
    }
    catch (const std::exception&)
    {
      RethrowMalformed();
    }
  }

  const void* HeapPointer(uint32_t offset)
  {
    return reinterpret_cast<const void*>(static_cast<uintptr_t>(offset));
  }

  std::string Property(const Parameters::Accessor& props, Parameters::Identifier name)
  {
    return props.FindString(name).value_or(std::string{});
  }

  //! Shape of one entry reported by detect(), also used for the picture payloads
  emscripten::val Describe(StringView subpath, const Module::Holder& holder)
  {
    auto entry = emscripten::val::object();
    entry.set("subpath", std::string{subpath});
    const auto props = holder.GetModuleProperties();
    entry.set("type", Property(*props, Module::ATTR_TYPE));
    entry.set("title", Property(*props, Module::ATTR_TITLE));
    entry.set("author", Property(*props, Module::ATTR_AUTHOR));
    entry.set("program", Property(*props, Module::ATTR_PROGRAM));
    // keep it a plain number- a 64 bit value would reach javascript as a BigInt
    entry.set("durationMs", static_cast<uint32_t>(holder.GetModuleInformation().Duration.Get()));
    return entry;
  }

  //! Walks everything inside a container and reports every module it can play.
  class Collector : public Module::DetectCallback
  {
  public:
    Collector()
      : Tracks(emscripten::val::array())
      , Pictures(emscripten::val::array())
    {}

    Parameters::Container::Ptr CreateInitialProperties(StringView /*subpath*/) const override
    {
      return Parameters::Container::Create();
    }

    void ProcessModule(const ZXTune::DataLocation& location, const ZXTune::Plugin& /*decoder*/,
                       Module::Holder::Ptr holder) override
    {
      Tracks.call<void>("push", Describe(location.GetPath()->AsString(), *holder));
    }

    void ProcessUnknownData(const ZXTune::DataLocation& location) override
    {
      const auto raw = location.GetData();
      const auto data = Binary::View(*raw);
      if (data.Size() > MAX_PICTURE_SIZE || !IsPicture(data))
      {
        return;
      }
      auto entry = emscripten::val::object();
      entry.set("subpath", location.GetPath()->AsString());
      // typed_memory_view aliases the heap, the Uint8Array constructor copies it out
      const auto view = emscripten::typed_memory_view(data.Size(), static_cast<const uint8_t*>(data.Start()));
      entry.set("data", emscripten::val::global("Uint8Array").new_(view));
      Pictures.call<void>("push", entry);
    }

    Log::ProgressCallback* GetProgress() const override
    {
      return nullptr;
    }

    emscripten::val Release()
    {
      auto result = emscripten::val::object();
      result.set("tracks", Tracks);
      result.set("pictures", Pictures);
      return result;
    }

  private:
    static const std::size_t MAX_PICTURE_SIZE = 2 * 1048576;

    static bool IsPicture(Binary::View data)
    {
      static const uint8_t PNG[] = {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
      static const uint8_t JPEG[] = {0xff, 0xd8, 0xff};
      const auto* const start = static_cast<const uint8_t*>(data.Start());
      return (data.Size() > sizeof(PNG) && 0 == std::memcmp(start, PNG, sizeof(PNG)))
             || (data.Size() > sizeof(JPEG) && 0 == std::memcmp(start, JPEG, sizeof(JPEG)));
    }

    emscripten::val Tracks;
    emscripten::val Pictures;
  };

  class Player
  {
  public:
    Player(Module::Holder::Ptr holder, uint32_t samplerate)
      : Holder(std::move(holder))
      , Options(Parameters::Container::Create())
      , Renderer(Module::CreatePipelinedRenderer(*Holder, samplerate,
                                                 Parameters::CreateMergedAccessor(Options, GlobalOptions())))
    {}

    //! Fills samples*2 int16 values at the given heap offset.
    //! @return false if the module is over- the rest of the buffer is silence
    bool render(uint32_t target, uint32_t samples)
    {
      return Guarded([&] {
      auto* out = reinterpret_cast<Sound::Sample*>(static_cast<uintptr_t>(target));
      auto rest = samples;
      while (rest != 0)
      {
        if (Position == Buffer.size())
        {
          Buffer = Renderer->Render();
          Position = 0;
          if (Buffer.empty())
          {
            break;
          }
        }
        const auto got = std::min<std::size_t>(rest, Buffer.size() - Position);
        std::memcpy(out, Buffer.data() + Position, got * sizeof(Sound::Sample));
        out += got;
        Position += got;
        rest -= got;
      }
      std::fill_n(out, rest, Sound::Sample());
      // the spectrum costs an fft per chunk, so it is only maintained while
      // javascript keeps asking for it. No locking here- unlike the jni layer
      // there is no second thread, render and analyze share one caller.
      if (Analyzer && IdleRenders++ < IDLE_RENDERS_LIMIT)
      {
        Analyzer->FeedSound(reinterpret_cast<const Sound::Sample*>(static_cast<uintptr_t>(target)), samples);
      }
      return rest == 0;
      });
    }

    //! Writes maxEntries spectrum levels, one byte each in 0..100, at the given heap offset.
    //! Levels are zero until the first chunk has been rendered with the analyzer awake.
    uint32_t analyze(uint32_t levels, uint32_t maxEntries)
    {
      if (!Analyzer)
      {
        Analyzer = Sound::FFTAnalyzer::Create();
      }
      IdleRenders = 0;
      auto* const target = reinterpret_cast<Sound::Analyzer::LevelType*>(static_cast<uintptr_t>(levels));
      Analyzer->GetSpectrum(target, maxEntries);
      return maxEntries;
    }

    uint32_t getPosition() const
    {
      return Renderer->GetState().At.CastTo<TimeBase>().Get();
    }

    //! Decoder snapshot, not the audible position (rendering may run ahead).
    emscripten::val state() const
    {
      return Guarded([this] {
        const auto current = Renderer->GetState();
        if (!current.Track)
        {
          return emscripten::val::null();
        }
        const auto& track = *current.Track;
        auto result = emscripten::val::object();
        result.set("position", track.Position);
        result.set("pattern", track.Pattern);
        result.set("line", track.Line);
        result.set("tempo", track.Tempo);
        result.set("channels", track.Channels);
        result.set("quirk", track.Quirk);
        result.set("timeMs", current.At.CastTo<TimeBase>().Get());
        return result;
      });
    }

    void seek(uint32_t position)
    {
      Guarded([&] {
        Renderer->SetPosition(Time::Instant<TimeBase>(position));
        Buffer = Sound::Chunk();
        Position = 0;
      });
    }

    void setProperty(const std::string& name, const std::string& value)
    {
      Options->SetValue(name, StringView{value});
    }

    //! Parameters::IntType is 64 bit; a double keeps it a plain javascript number
    void setIntProperty(const std::string& name, double value)
    {
      Options->SetValue(name, static_cast<Parameters::IntType>(value));
    }

  private:
    static const uint32_t IDLE_RENDERS_LIMIT = 10;

    const Module::Holder::Ptr Holder;
    const Parameters::Container::Ptr Options;
    const Module::Renderer::Ptr Renderer;
    Sound::Chunk Buffer;
    std::size_t Position = 0;
    Sound::FFTAnalyzer::Ptr Analyzer;
    uint32_t IdleRenders = 0;
  };

  class Track
  {
  public:
    explicit Track(Module::Holder::Ptr holder)
      : Holder(std::move(holder))
    {}

    uint32_t getDuration() const
    {
      return Guarded([this] { return static_cast<uint32_t>(Holder->GetModuleInformation().Duration.Get()); });
    }

    std::string getProperty(const std::string& name, const std::string& defVal) const
    {
      return Guarded([&] { return Holder->GetModuleProperties()->FindString(name).value_or(defVal); });
    }

    std::shared_ptr<Player> createPlayer(uint32_t samplerate) const
    {
      return Guarded([&] { return std::make_shared<Player>(Holder, samplerate); });
    }

    //! The notes the track plays and the time each one starts, read out of the
    //! pattern data instead of guessed from the waveform. A rhythm game can be
    //! built from this and stay on the beat whatever the tune does.
    //!
    //! n is the tracker's note number. It indexes that format's frequency table
    //! (src/core/plugins/players/ay/freq_tables.cpp), where the period falls as
    //! the number rises, so within one tune a bigger number is a higher tone -
    //! which is all a caller needs to sort the notes by pitch. The numbers are
    //! not comparable between formats, each with its own table.
    //!
    //! Only tracker-structured modules have patterns. A ym file is a dump of
    //! chip registers per frame rather than a pattern, and this throws for it.
    //!
    //! @param maxMs stop once the playhead passes this, the caller only ever
    //!              charts the excerpt it is going to play
    //! @return one entry per note: t milliseconds, c channel, n note number,
    //!         v volume or -1, r row index counted over the whole order so the
    //!         beat phase does not restart at every pattern, d how long the note
    //!         sounds in milliseconds (the gap to the next note on its own
    //!         channel, 0 when nothing follows it to measure from)
    emscripten::val notes(uint32_t maxMs) const
    {
      // The check stays outside Guarded: inside it, the catch-all that covers
      // parser failures would turn "this format has no patterns" into
      // "unsupported or malformed content" and the caller could not tell the
      // two apart.
      const auto* const aym = Tracker();
      return Guarded([&, maxMs] { return Collect(*aym, maxMs); });
    }

   private:
    //! Walks the order once, calling visit(line, channel, note) for every note.
    //! The row times come out of the same accounting the decoder uses, so what a
    //! caller is told and what the player will hear are one clock.
    template<class Visit>
    static void Walk(const Module::AYM::Holder& holder, uint32_t maxMs, Visit&& visit)
    {
      const auto chiptune = holder.GetChiptune();
      const auto model = chiptune->FindTrackModel();
      const auto& order = model->GetOrder();
      const auto& patterns = model->GetPatterns();
      // one tracker tick; a line lasts a whole number of them, and that count is
      // what the tempo commands set
      const auto tick = chiptune->GetFrameDuration();
      Time::Microseconds at{};
      uint_t tempo = model->GetInitialTempo();
      uint_t row = 0;
      for (uint_t pos = 0, positions = order.GetSize(); pos < positions; ++pos)
      {
        const auto pattern = order.GetPatternIndex(pos);
        const auto* const data = patterns.Get(pattern);
        const auto lines = data ? data->GetSize() : 0;
        for (uint_t line = 0; line < lines; ++line)
        {
          if (const auto lineTempo = model->GetLineTempo({.Pattern = pattern, .Line = line}))
          {
            tempo = lineTempo;
          }
          const auto atMs = at.CastTo<Time::Millisecond>().Get();
          if (atMs >= maxMs)
          {
            return;
          }
          if (const auto* const lineData = data->GetLine(line))
          {
            lineData->ForEachChannel([&](uint_t channel, const Module::Cell& cell) {
              if (const auto* const note = cell.GetNote())
              {
                const auto* const volume = cell.GetVolume();
                visit(atMs, channel, *note, volume ? *volume : uint_t(-1), row);
              }
            });
          }
          at += tick * tempo;
          ++row;
        }
      }
    }

    //! The holder as a tracker, or a complaint the caller can show.
    const Module::AYM::Holder* Tracker() const
    {
      const auto* const aym = dynamic_cast<const Module::AYM::Holder*>(Holder.get());
      if (!aym || !aym->GetChiptune() || !aym->GetChiptune()->FindTrackModel())
      {
        throw std::runtime_error("this format is not tracker structured");
      }
      return aym;
    }

    static emscripten::val Collect(const Module::AYM::Holder& holder, uint32_t maxMs)
    {
      // Collected first and handed over afterwards, because a note's length is
      // only known once the next note on its own channel has been seen. A cell
      // carries no duration of its own (src/module/players/track_model.h), so
      // this is the accounting the player itself uses: a note sounds until its
      // channel retriggers it.
      struct Reported
      {
        uint32_t AtMs;
        uint_t Channel;
        uint_t Note;
        int_t Volume;
        uint_t Row;
        uint32_t DurationMs = 0;
      };
      std::vector<Reported> notes;
      Walk(holder, maxMs, [&](uint32_t atMs, uint_t channel, uint_t note, uint_t volume, uint_t row) {
        notes.push_back({.AtMs = atMs, .Channel = channel, .Note = note,
                         .Volume = volume == uint_t(-1) ? -1 : static_cast<int_t>(volume), .Row = row});
      });
      // a note sounds until its own channel says otherwise. Walked backwards
      // with the next note on each channel in hand: the notes come in time
      // order with the channels interleaved, so looking at the note that
      // happens to follow finds the next row rather than the next note.
      uint32_t nextAt[8] = {0};
      bool hasNext[8] = {false, false, false, false, false, false, false, false};
      for (std::size_t i = notes.size(); i-- > 0;)
      {
        const auto channel = notes[i].Channel;
        if (channel < 8)
        {
          notes[i].DurationMs = hasNext[channel] ? nextAt[channel] - notes[i].AtMs : 0;
          nextAt[channel] = notes[i].AtMs;
          hasNext[channel] = true;
        }
      }
      auto result = emscripten::val::array();
      for (const auto& note : notes)
      {
        auto entry = emscripten::val::object();
        entry.set("t", static_cast<double>(note.AtMs));
        entry.set("c", note.Channel);
        entry.set("n", static_cast<double>(note.Note));
        entry.set("v", static_cast<double>(note.Volume));
        entry.set("r", note.Row);
        entry.set("d", static_cast<double>(note.DurationMs));
        result.call<void>("push", entry);
      }
      return result;
    }

   public:

    //! Sibling files this module needs before it can be played- an xsf library,
    //! the streams of a split vgmstream set. Empty for everything self-contained.
    emscripten::val getAdditionalFiles() const
    {
      return Guarded([this] {
        auto result = emscripten::val::array();
        if (const auto* const files = dynamic_cast<const Module::AdditionalFiles*>(Holder.get()))
        {
          for (const auto& name : files->Enumerate())
          {
            result.call<void>("push", name);
          }
        }
        return result;
      });
    }

    //! @param data heap offset of the named file's content
    void resolveAdditionalFile(const std::string& name, uint32_t data, uint32_t size)
    {
      // the holder owns the resolution state, hence the cast away from the const Ptr
      auto* const files = const_cast<Module::AdditionalFiles*>(dynamic_cast<const Module::AdditionalFiles*>(Holder.get()));
      if (!files)
      {
        throw std::runtime_error("module needs no additional files");
      }
      Guarded([&] { files->Resolve(name, Binary::CreateContainer(Binary::View(HeapPointer(data), size))); });
    }

  private:
    const Module::Holder::Ptr Holder;
  };

  //! @param data heap offset of the raw module content, @param subpath entry inside the container
  std::shared_ptr<Track> load(uint32_t data, uint32_t size, const std::string& subpath)
  {
    try
    {
      auto content = Binary::CreateContainer(Binary::View(HeapPointer(data), size));
      return std::make_shared<Track>(
          Service().OpenModule(std::move(content), subpath, Parameters::Container::Create()));
    }
    catch (const Error& e)
    {
      Rethrow(e);
    }
    catch (const std::exception&)
    {
      RethrowMalformed();
    }
  }

  //! Reads the notes out of a ym file, in the same shape Track::notes() reports.
  //!
  //! A ym file has no patterns- it is a dump of the AY-3-8910 registers, one
  //! frame per line - so there is nothing for the track model to give. The
  //! engine's own decoder does the reading (it is what expands the compressed
  //! variant), and the notes are picked out of the register stream here: a
  //! channel whose tone period changes while it is audible starts a new note.
  class YMNotes : public Formats::Chiptune::YM::Builder
  {
  public:
    Formats::Chiptune::MetaBuilder& GetMetaBuilder() override
    {
      return Formats::Chiptune::GetStubMetaBuilder();
    }

    void SetVersion(StringView /*version*/) override {}
    void SetChipType(bool /*ym*/) override {}
    void SetStereoMode(uint_t /*mode*/) override {}
    void SetLoop(uint_t /*loop*/) override {}
    void SetDigitalSample(uint_t /*idx*/, Binary::View /*data*/) override {}
    void SetYear(uint_t /*year*/) override {}
    void SetEditor(StringView /*editor*/) override {}

    void SetClockrate(uint64_t freq) override
    {
      Clock = freq;
    }

    void SetIntFreq(uint_t freq) override
    {
      FrameRate = freq;
    }

    void AddData(Binary::View registers) override
    {
      // The dump is in the chip's own register order, and the engine's device
      // reads it the same way (src/devices/aym/src/psg.h, GetToneA): the fine
      // register is the low byte of a tone period and it comes first. Reading
      // the pair the other way round built every period out of two halves of
      // different notes, so the pitches were wrong by an unpredictable interval
      // and the "too high to hear" guard threw real notes away while keeping
      // register values that never sounded at all.
      const auto* const reg = registers.As<uint8_t>();
      if (nullptr == reg || registers.Size() < 14)
      {
        return;
      }
      // The engine's mixer register keeps the three tone enables in bits 0, 1
      // and 2 and the three noise enables in 3, 4 and 5 (src/devices/aym.h), and
      // the ym file's raw byte is handed to it unmapped. Reading the datasheet's
      // layout instead leaves the third channel reported muted for the whole
      // tune: 486 sounding frames against 10591, so two thirds of the music was
      // missing from the chart.
      static const std::size_t TONE_BIT[3] = {0, 1, 2};
      const uint8_t mixer = reg[7];
      for (uint_t ch = 0; ch != 3; ++ch)
      {
        const auto period = static_cast<uint_t>((reg[ch * 2 + 1] << 8) | reg[ch * 2]);
        const auto hz = ToneHz(period);
        const bool on = 0 == (mixer & (1 << TONE_BIT[ch]));
        // A period is not a pitch check on its own: a channel left holding a
        // large period count keeps "playing" at two hertz, which is not a note
        // a player can be asked to hit. Only tones a person can hear are notes.
        const bool sounding = on && hz >= MIN_TONE_HZ && hz <= MAX_TONE_HZ && reg[8 + ch] != 0;
        // A tuner writes the volume register on every frame and slides write a
        // slightly different period on every frame, so neither a volume change
        // nor a small period change is a note. A note is the channel starting
        // from silence, or the period moving by a whole step or more.
        const bool attack = sounding && !Audible[ch];
        const uint_t moved = period > Periods[ch] ? period - Periods[ch] : Periods[ch] - period;
        const bool jump = sounding && Audible[ch] && moved * 100 >= Periods[ch] * 6;
        if (attack || jump)
        {
          Candidates.push_back({.Frame = Frame, .Channel = ch, .Period = period, .Volume = reg[8 + ch]});
        }
        Periods[ch] = period;
        Audible[ch] = sounding;
      }
      ++Frame;
    }

    //! Turns the collected candidates into the note list javascript expects:
    //! audible pitches only, and no channel closer to its last note than the
    //! game allows anyway, so a slide becomes one note and not a stream.
    //!
    //! d is how long the note sounds, in milliseconds: the gap to the next note
    //! on its own channel. That is what the chip sustains until something
    //! retriggers it, so a caller can tell a held note from a stab. The last
    //! note on a channel reports 0, because nothing follows it to measure from.
    emscripten::val Release(uint32_t maxMs) const
    {
      const auto rate = FrameRate ? FrameRate : 50;
      // The gap has to round up to whole frames. Truncating it left the filter
      // smaller than one frame's worth of time at every rate, so it let through
      // notes a player cannot tell apart: at 50Hz, 50*55/1000 is 2 frames, which
      // is 40ms and lets a pair of ornaments 40ms apart both through.
      const auto minGap = std::max<uint_t>(1, (55 * rate + 999) / 1000);
      std::vector<Reported> kept;
      long lastFrame[3] = {-1, -1, -1};
      for (const auto& note : Candidates)
      {
        if (lastFrame[note.Channel] >= 0 && note.Frame - static_cast<uint_t>(lastFrame[note.Channel]) < minGap)
        {
          continue;
        }
        const auto atMs = static_cast<uint64_t>(note.Frame * 1000ull / rate);
        if (atMs >= maxMs)
        {
          break;
        }
        lastFrame[note.Channel] = static_cast<long>(note.Frame);
        kept.push_back({.AtMs = atMs, .Channel = note.Channel, .Pitch = Semitones(Clock, note.Period),
                        .Volume = note.Volume, .Frame = note.Frame, .DurationMs = 0});
      }
      // a note sounds until its own channel retriggers it, which is the next
      // note on that channel and not the note that happens to follow: the list
      // is in time order with the three channels interleaved.
      uint64_t nextAt[3] = {0};
      for (std::size_t i = kept.size(); i-- > 0;)
      {
        kept[i].DurationMs = nextAt[kept[i].Channel] ? static_cast<uint32_t>(nextAt[kept[i].Channel] - kept[i].AtMs) : 0;
        nextAt[kept[i].Channel] = kept[i].AtMs;
      }
      auto result = emscripten::val::array();
      for (const auto& note : kept)
      {
        auto entry = emscripten::val::object();
        entry.set("t", static_cast<double>(note.AtMs));
        entry.set("c", note.Channel);
        entry.set("n", note.Pitch);
        entry.set("v", note.Volume);
        entry.set("r", note.Frame);
        entry.set("d", static_cast<double>(note.DurationMs));
        result.call<void>("push", entry);
      }
      return result;
    }

  private:
    struct Candidate
    {
      uint_t Frame;
      uint_t Channel;
      uint_t Period;
      uint_t Volume;
    };

    struct Reported
    {
      uint64_t AtMs;
      uint_t Channel;
      double Pitch;
      uint_t Volume;
      uint_t Frame;
      uint32_t DurationMs;
    };

    //! What a tone period sounds at, or 0 for a channel with no period at all.
    uint32_t ToneHz(uint_t period) const
    {
      return period ? static_cast<uint32_t>(Clock / (16ull * period)) : 0;
    }

    //! f = clock / (16 * period); whole steps above the quietest period.
    static double Semitones(uint64_t clock, uint_t period)
    {
      return clock && period ? std::round(12.0 * std::log2(static_cast<double>(clock) / (16.0 * period))) : 0.0;
    }

    //! A bass note bottoms out around 40Hz and a chiptune's top stays under
    //! 12kHz, so anything outside that band is a register left at a value no
    //! player could be asked to hit rather than a note in the tune.
    static const uint32_t MIN_TONE_HZ = 40;
    static const uint32_t MAX_TONE_HZ = 12000;

    std::vector<Candidate> Candidates;
    uint_t Periods[3] = {0, 0, 0};
    bool Audible[3] = {false, false, false};
    uint_t Frame = 0;
    uint_t FrameRate = 0;
    uint64_t Clock = 0;
  };

  //! @param data heap offset of a ym file, @param size its length
  emscripten::val ymNotes(uint32_t data, uint32_t size, uint32_t maxMs)
  {
    try
    {
      auto content = Binary::CreateContainer(Binary::View(HeapPointer(data), size));
      // packed first: the compressed variant starts with a header that a plain
      // ym would never have, so the decoders do not both claim it
      for (const auto& decoder : {Formats::Chiptune::YM::CreatePackedYMDecoder(),
                                  Formats::Chiptune::YM::CreateYMDecoder()})
      {
        YMNotes notes;
        if (decoder->Parse(*content, notes))
        {
          return notes.Release(maxMs);
        }
      }
    }
    catch (const Error& e)
    {
      Rethrow(e);
    }
    catch (const std::exception&)
    {
      RethrowMalformed();
    }
    throw std::runtime_error("this file has no ym register dump");
  }

  //! Library-wide parameters, shared by every player created afterwards.
  //! Names live in src/sound/sound_parameters.h and src/core/core_parameters.h.
  std::string getOption(const std::string& name, const std::string& defVal)
  {
    return GlobalOptions()->FindString(name).value_or(defVal);
  }

  void setOption(const std::string& name, const std::string& value)
  {
    GlobalOptions()->SetValue(name, StringView{value});
  }

  double getIntOption(const std::string& name, double defVal)
  {
    const auto found = GlobalOptions()->FindInteger(name);
    return found ? static_cast<double>(*found) : defVal;
  }

  void setIntOption(const std::string& name, double value)
  {
    GlobalOptions()->SetValue(name, static_cast<Parameters::IntType>(value));
  }

  //! Lists every module inside the content, plus any cover art found along the way.
  //! Unlike load() this does not throw when nothing is playable- the arrays come back empty.
  emscripten::val detect(uint32_t data, uint32_t size)
  {
    try
    {
      auto content = Binary::CreateContainer(Binary::View(HeapPointer(data), size));
      Collector collector;
      Service().DetectModules(std::move(content), collector);
      return collector.Release();
    }
    catch (const Error& e)
    {
      Rethrow(e);
    }
    catch (const std::exception&)
    {
      RethrowMalformed();
    }
  }

  //! Every plugin the library was built with, players and containers alike:
  //! {id, description, caps}. caps is the bitmask from core/plugin_attrs.h.
  emscripten::val plugins()
  {
    class PluginsCollector : public ZXTune::PluginVisitor
    {
    public:
      void Visit(const ZXTune::Plugin& plugin) override
      {
        auto entry = emscripten::val::object();
        entry.set("id", std::string{plugin.Id()});
        entry.set("description", std::string{plugin.Description()});
        entry.set("caps", plugin.Capabilities());
        Result.call<void>("push", entry);
      }

      emscripten::val Result = emscripten::val::array();
    };
    PluginsCollector collector;
    ZXTune::EnumeratePlugins(collector);
    return collector.Result;
  }
}  // namespace

EMSCRIPTEN_BINDINGS(zxtune)
{
  emscripten::class_<Player>("Player")
      .smart_ptr<std::shared_ptr<Player>>("PlayerPtr")
      .function("render", &Player::render)
      .function("seek", &Player::seek)
      .function("getPosition", &Player::getPosition)
      .function("state", &Player::state)
      .function("setProperty", &Player::setProperty)
      .function("setIntProperty", &Player::setIntProperty)
      .function("analyze", &Player::analyze);

  emscripten::class_<Track>("Track")
      .smart_ptr<std::shared_ptr<Track>>("TrackPtr")
      .function("getDuration", &Track::getDuration)
      .function("getProperty", &Track::getProperty)
      .function("createPlayer", &Track::createPlayer)
      .function("notes", &Track::notes)
      .function("getAdditionalFiles", &Track::getAdditionalFiles)
      .function("resolveAdditionalFile", &Track::resolveAdditionalFile);

  emscripten::function("load", &load);
  emscripten::function("ymNotes", &ymNotes);
  emscripten::function("detect", &detect);
  emscripten::function("plugins", &plugins);

  emscripten::function("getOption", &getOption);
  emscripten::function("setOption", &setOption);
  emscripten::function("getIntOption", &getIntOption);
  emscripten::function("setIntOption", &setIntOption);
}
