config.bind('cs', 'config-source')

config.bind('zi', 'zoom-in')
config.bind('zo', 'zoom-out')
config.bind('zz', 'zoom {}'.format(c.zoom.default))

config.bind('si', 'hint images download')

config.bind('<Ctrl-p>', 'completion-item-focus --history prev', mode='command')
config.bind('<Ctrl-n>', 'completion-item-focus --history next', mode='command')

config.bind('gp', 'open -p')

config.bind('<Escape>', 'mode-leave ;; click-element id tampermonkey-decoy-clicker', mode='insert')
config.bind('<Escape>', 'click-element id tampermonkey-decoy-clicker', mode='normal')
config.bind(';m', 'hint links spawn --userscript ~/.local/bin/url2mpv.sh {hint-url} --from-browser "chromium:~/.local/share/qutebrowser"')
config.bind(',m', 'spawn --userscript ~/.local/bin/url2mpv.sh {url} --from-browser "chromium:~/.local/share/qutebrowser"')


config.bind('.', 'config-cycle tabs.show always never')
config.bind(',', 'config-cycle tabs.width 20% 10%')
config.bind('<Ctrl-Shift-j>', 'tab-move +')
config.bind('<Ctrl-Shift-k>', 'tab-move -')

config.bind('b', 'config-cycle statusbar.show always never')
config.bind('tg', 'tab-focus 1')
config.bind('tG', 'tab-focus -1')
config.bind('I', 'config-cycle colors.webpage.darkmode.enabled false true')

config.bind('cm', 'clear-messages')
config.bind('ca', 'download-cancel')
