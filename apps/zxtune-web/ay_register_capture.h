// Observe the actual AY/YM device used by the renderer, without a second decoder.
#pragma once

#include "module/players/aym/aym_base.h"
#include "make_ptr.h"

#include <array>

namespace Web
{
  struct AYRegisterCapture
  {
    using Values = std::array<uint8_t, Devices::AYM::Registers::TOTAL>;
    Values Current{};
    bool Supported = false;
    bool Enabled = false;

    void Apply(const Devices::AYM::Registers& data)
    {
      using R = Devices::AYM::Registers;
      for (R::IndicesIterator it(data); it; ++it)
      {
        const auto reg = *it;
        auto value = data[reg];
        // Match PSG::SetNewData, including retained values on partial writes.
        if (reg == R::TONEA_H || reg == R::TONEB_H || reg == R::TONEC_H || reg == R::ENV)
        {
          value &= 0x0f;
        }
        else if (reg == R::TONEN || reg == R::VOLA || reg == R::VOLB || reg == R::VOLC)
        {
          value &= 0x1f;
        }
        Current[reg] = value;
      }
    }
  };

  class ObservedAYChip : public Devices::AYM::Chip
  {
  public:
    ObservedAYChip(Devices::AYM::Chip::Ptr chip, std::shared_ptr<AYRegisterCapture> capture)
      : Delegate(std::move(chip)), Capture(std::move(capture))
    {}

    void RenderData(const Devices::AYM::DataChunk& data) override
    {
      Delegate->RenderData(data);
      Capture->Apply(data.Data);
    }

    void RenderData(const std::vector<Devices::AYM::DataChunk>& data) override
    {
      Delegate->RenderData(data);
      for (const auto& chunk : data)
      {
        Capture->Apply(chunk.Data);
      }
    }

    void Reset() override
    {
      Delegate->Reset();
      Capture->Current.fill(0);
    }

    Sound::Chunk RenderTill(Devices::AYM::Stamp till) override
    {
      return Delegate->RenderTill(till);
    }

  private:
    const Devices::AYM::Chip::Ptr Delegate;
    const std::shared_ptr<AYRegisterCapture> Capture;
  };

  class ObservedAYHolder : public Module::Holder
  {
  public:
    ObservedAYHolder(Module::Holder::Ptr holder, std::shared_ptr<AYRegisterCapture> capture)
      : Delegate(std::move(holder)), Capture(std::move(capture))
    {}

    Module::Information GetModuleInformation() const override
    {
      return Delegate->GetModuleInformation();
    }

    Parameters::Accessor::Ptr GetModuleProperties() const override
    {
      return Delegate->GetModuleProperties();
    }

    Module::Renderer::Ptr CreateRenderer(uint_t samplerate, Parameters::Accessor::Ptr params) const override
    {
      if (const auto* ay = dynamic_cast<const Module::AYM::Holder*>(Delegate.get()))
      {
        auto chip = Module::AYM::CreateChip(samplerate, params);
        auto observed = MakePtr<ObservedAYChip>(std::move(chip), Capture);
        auto renderer = ay->CreateRenderer(samplerate, std::move(params), std::move(observed));
        Capture->Supported = true;
        return renderer;
      }
      return Delegate->CreateRenderer(samplerate, std::move(params));
    }

  private:
    const Module::Holder::Ptr Delegate;
    const std::shared_ptr<AYRegisterCapture> Capture;
  };
}
