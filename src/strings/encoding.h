/**
 *
 * @file
 *
 * @brief  Encoding-related
 *
 * @author vitamin.caig@gmail.com
 *
 **/

#pragma once

#include "string_type.h"
#include "string_view.h"
#include "strings/utf16.h"

namespace Strings
{
  String ToAutoUtf8(StringView str);

  String Utf16ToUtf8(Utf16View str);
}  // namespace Strings
