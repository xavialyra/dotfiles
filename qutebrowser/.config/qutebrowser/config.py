
config.source('colors.py')

config.load_autoconfig(False) # ignore GUI settings

# Config ######################################################################
c.qt.environ = {'NODE_PATH': '/usr/lib/node_modules'}
# c.editor.command = ['ghostty', '--class=ghostty.float', '--command=nvim -c "normal {line}G{column}|" {file}']
c.editor.command = ['footclient', '-T', 'Floating_Term', '-o', 'colors.alpha=0.9', 'nvim', '{file}', '-c', 'normal {line}G{column0}l']

fileChooser = ['footclient', '-T', 'Floating_Term', '-o', 'colors.alpha=0.9', 'yazi', '--chooser-file={}']
c.fileselect.handler = "external"
c.fileselect.folder.command = fileChooser
c.fileselect.multiple_files.command = fileChooser
c.fileselect.single_file.command = fileChooser

c.url.start_pages = 'file:///dev/null'
c.url.default_page= 'file:///dev/null'
c.auto_save.session = True


c.zoom.default = 100
c.zoom.levels = ["25%", "33%", "50%", "67%", "75%", "90%", "100%", "125%", "133%", "150%", "175%", "200%", "250%", "300%"]
c.fonts.web.size.default = 20 # webpage
c.fonts.default_size = '14pt' # UI
c.scrolling.smooth = True

# c.colors.webpage.darkmode.enabled = True
# c.colors.webpage.darkmode.policy.images = 'never'
# c.colors.webpage.bg = '#191919' # fix darkmode white flash

c.tabs.show = "never"

c.downloads.location.directory = "~/Downloads"
c.downloads.location.prompt = False
c.downloads.location.suggestion = 'both'
c.downloads.location.remember = False
c.downloads.remove_finished = 3300
c.downloads.position = "bottom"

c.tabs.show = "always"
c.tabs.position = "left"
c.tabs.padding = {"bottom":0, "left":0, "right":0, "top":0}
c.tabs.indicator.width = 0
c.tabs.width = '10%'
c.statusbar.show = "always"
c.completion.height = '30%'

c.keyhint.delay = 0
c.hints.uppercase = False
c.hints.chars = "asdfjkl;"

# colors
# c.colors.statusbar.normal.bg = '#427b58'
# c.colors.statusbar.command.bg = '#427b58'
# c.colors.statusbar.insert.bg = '#b16286'
# c.colors.statusbar.normal.fg = '#eeeeee'
# c.colors.statusbar.command.fg = '#eeeeee'
# c.colors.hints.bg = '#427b58'
# c.colors.hints.match.fg = '#eeeeee'


# content
c.content.fullscreen.window = True
# c.content.autoplay = False
c.content.blocking.enabled = True
c.content.blocking.method = 'both'
c.content.blocking.adblock.lists = [
  "https://easylist.to/easylist/easylist.txt",
  "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
  "https://easylist.to/easylist/easyprivacy.txt",
  "https://secure.fanboy.co.nz/fanboy-annoyance.txt",]

# privacy
# c.content.canvas_reading = False
# c.content.geolocation = False
# c.content.webrtc_ip_handling_policy = "default-public-interface-only"
# c.completion.open_categories = ['filesystem']

#c.content.proxy = "http://localhost:PORT"

# hint
c.hints.selectors["all"].extend([".qutebrowser-custom-click"])

c.hints.selectors.update({
    'text-regions': [
        '.text-region-wrapper',
    ]
})

# keybindings #################################################################
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
