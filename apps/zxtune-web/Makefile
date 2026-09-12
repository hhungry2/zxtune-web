binary_name := zxtune
dirs.root := ../..

source_dirs := .

libraries.common = analysis \
                   binary binary_compression binary_format \
                   core core_plugins_archives core_plugins_players \
                   devices_aym devices_beeper devices_dac devices_fm devices_saa devices_z80 \
                   formats_chiptune formats_packed formats_archived formats_archived_multitrack formats_multitrack \
                   module module_players \
                   parameters \
                   sound strings \
                   tools

libraries.3rdparty = asap atrac9 ffmpeg FLAC gme he ht hvl lazyusf2 lhasa lzma mpg123 ogg openmpt opus mgba sidplayfp snesspc sseqplayer unrar v2m vgm vgmstream vio2sf vorbis xmp z80ex zlib

ld_flags += -lembind -sEXPORT_NAME=createZXTune -sENVIRONMENT=web,worker,node \
            -sEXPORTED_FUNCTIONS=_malloc,_free \
            -sEXPORTED_RUNTIME_METHODS=HEAP16,HEAPU8,getExceptionMessage

include $(dirs.root)/makefile.mak

install_$(platform):
	$(call copyfile_cmd,$(target),$(DESTDIR))
	$(call copyfile_cmd,$(basename $(target)).wasm,$(DESTDIR))
