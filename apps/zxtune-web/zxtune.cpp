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
#include "core/service.h"
#include "module/attributes.h"
#include "module/holder.h"
#include "module/players/pipeline.h"
#include "parameters/container.h"
#include "parameters/merged_accessor.h"
#include "sound/chunk.h"
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
      return rest == 0;
    }

    uint32_t getPosition() const
    {
      return Renderer->GetState().At.CastTo<TimeBase>().Get();
    }

    void seek(uint32_t position)
    {
      Renderer->SetPosition(Time::Instant<TimeBase>(position));
      Buffer = Sound::Chunk();
      Position = 0;
    }

    void setProperty(const std::string& name, const std::string& value)
    {
      Options->SetValue(name, StringView{value});
    }

  private:
    const Module::Holder::Ptr Holder;
    const Parameters::Container::Ptr Options;
    const Module::Renderer::Ptr Renderer;
    Sound::Chunk Buffer;
    std::size_t Position = 0;
  };

  class Track
  {
  public:
    explicit Track(Module::Holder::Ptr holder)
      : Holder(std::move(holder))
    {}

    uint32_t getDuration() const
    {
      return Holder->GetModuleInformation().Duration.Get();
    }

    std::string getProperty(const std::string& name, const std::string& defVal) const
    {
      return Holder->GetModuleProperties()->FindString(name).value_or(defVal);
    }

    std::shared_ptr<Player> createPlayer(uint32_t samplerate) const
    {
      return std::make_shared<Player>(Holder, samplerate);
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
  }
}  // namespace

EMSCRIPTEN_BINDINGS(zxtune)
{
  emscripten::class_<Player>("Player")
      .smart_ptr<std::shared_ptr<Player>>("PlayerPtr")
      .function("render", &Player::render)
      .function("seek", &Player::seek)
      .function("getPosition", &Player::getPosition)
      .function("setProperty", &Player::setProperty);

  emscripten::class_<Track>("Track")
      .smart_ptr<std::shared_ptr<Track>>("TrackPtr")
      .function("getDuration", &Track::getDuration)
      .function("getProperty", &Track::getProperty)
      .function("createPlayer", &Track::createPlayer);

  emscripten::function("load", &load);
  emscripten::function("detect", &detect);
}
