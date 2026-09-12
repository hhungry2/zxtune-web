/**
 *
 * @file
 *
 * @brief Emscripten bindings implementation
 *
 **/

#include "binary/container_factories.h"
#include "core/service.h"
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
      auto content = Binary::CreateContainer(
          Binary::View(reinterpret_cast<const void*>(static_cast<uintptr_t>(data)), size));
      return std::make_shared<Track>(
          Service().OpenModule(std::move(content), subpath, Parameters::Container::Create()));
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
}
