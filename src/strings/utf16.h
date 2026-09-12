/**
 *
 * @file
 *
 * @brief  Utf-16 strings support
 *
 **/

#pragma once

#include <compare>
#include <cstdint>
#include <iosfwd>
#include <string>
#include <string_view>

namespace Strings
{
  //! libstdc++ instantiates its generic std::char_traits for any type, libc++ does not,
  //! so utf-16 strings have to bring their own traits instead of relying on the extension
  struct Utf16Traits
  {
    using char_type = uint16_t;
    using int_type = uint32_t;
    using off_type = std::streamoff;
    using pos_type = std::streampos;
    using state_type = std::mbstate_t;
    using comparison_category = std::strong_ordering;

    static constexpr void assign(char_type& dst, const char_type& src) noexcept
    {
      dst = src;
    }

    static constexpr char_type* assign(char_type* dst, std::size_t count, char_type val)
    {
      for (std::size_t idx = 0; idx < count; ++idx)
      {
        dst[idx] = val;
      }
      return dst;
    }

    static constexpr bool eq(char_type lh, char_type rh) noexcept
    {
      return lh == rh;
    }

    static constexpr bool lt(char_type lh, char_type rh) noexcept
    {
      return lh < rh;
    }

    static constexpr int compare(const char_type* lh, const char_type* rh, std::size_t count)
    {
      for (; count != 0; --count, ++lh, ++rh)
      {
        if (*lh != *rh)
        {
          return *lh < *rh ? -1 : 1;
        }
      }
      return 0;
    }

    static constexpr std::size_t length(const char_type* str)
    {
      std::size_t res = 0;
      while (str[res] != 0)
      {
        ++res;
      }
      return res;
    }

    static constexpr const char_type* find(const char_type* str, std::size_t count, const char_type& val)
    {
      for (; count != 0; --count, ++str)
      {
        if (*str == val)
        {
          return str;
        }
      }
      return nullptr;
    }

    static constexpr char_type* move(char_type* dst, const char_type* src, std::size_t count)
    {
      if (dst < src)
      {
        for (std::size_t idx = 0; idx < count; ++idx)
        {
          dst[idx] = src[idx];
        }
      }
      else if (dst > src)
      {
        for (std::size_t idx = count; idx != 0; --idx)
        {
          dst[idx - 1] = src[idx - 1];
        }
      }
      return dst;
    }

    static constexpr char_type* copy(char_type* dst, const char_type* src, std::size_t count)
    {
      for (std::size_t idx = 0; idx < count; ++idx)
      {
        dst[idx] = src[idx];
      }
      return dst;
    }

    static constexpr int_type not_eof(int_type val) noexcept
    {
      return val == eof() ? 0 : val;
    }

    static constexpr char_type to_char_type(int_type val) noexcept
    {
      return static_cast<char_type>(val);
    }

    static constexpr int_type to_int_type(char_type val) noexcept
    {
      return val;
    }

    static constexpr bool eq_int_type(int_type lh, int_type rh) noexcept
    {
      return lh == rh;
    }

    static constexpr int_type eof() noexcept
    {
      return static_cast<int_type>(-1);
    }
  };

  using Utf16View = std::basic_string_view<uint16_t, Utf16Traits>;
  using Utf16String = std::basic_string<uint16_t, Utf16Traits>;
}  // namespace Strings
