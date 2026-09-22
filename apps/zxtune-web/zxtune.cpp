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
#include "module/additional_files.h"
#include "module/attributes.h"
#include "module/holder.h"
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
      .function("setProperty", &Player::setProperty)
      .function("setIntProperty", &Player::setIntProperty)
      .function("analyze", &Player::analyze);

  emscripten::class_<Track>("Track")
      .smart_ptr<std::shared_ptr<Track>>("TrackPtr")
      .function("getDuration", &Track::getDuration)
      .function("getProperty", &Track::getProperty)
      .function("createPlayer", &Track::createPlayer)
      .function("getAdditionalFiles", &Track::getAdditionalFiles)
      .function("resolveAdditionalFile", &Track::resolveAdditionalFile);

  emscripten::function("load", &load);
  emscripten::function("detect", &detect);
  emscripten::function("plugins", &plugins);

  emscripten::function("getOption", &getOption);
  emscripten::function("setOption", &setOption);
  emscripten::function("getIntOption", &getIntOption);
  emscripten::function("setIntOption", &setIntOption);
}
