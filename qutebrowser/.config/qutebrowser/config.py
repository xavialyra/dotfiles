config.load_autoconfig(False) # ignore GUI settings

# Config ######################################################################
# c.editor.command = ['ghostty', '--class=ghostty.float', 'nvim', '{file}', '-c', 'normal {line}G{column0}l']
#zc.editor.command = ['ghostty', '--class=ghostty.float', 'nvim', '+{line}', '{file}']
# c.editor.command = ['ghostty', '--class=ghostty.float', 'nvim', '{file}', '-c', 'normal {line}G{column}|']
#c.editor.command = ['ghostty', '--class=ghostty.float', '--command=nvim +{line} {file}']
c.qt.environ = {'NODE_PATH': '/usr/lib/node_modules'}
c.editor.command = ['ghostty', '--class=ghostty.float', '--command=nvim -c "normal {line}G{column}|" {file}']
c.url.start_pages = 'file:///dev/null'
c.url.default_page= 'file:///dev/null'

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
c.downloads.position = "bottom"

c.colors.statusbar.normal.bg = '#427b58'
c.colors.statusbar.command.bg = '#427b58'
c.colors.statusbar.insert.bg = '#b16286'
c.colors.statusbar.normal.fg = '#eeeeee'
c.colors.statusbar.command.fg = '#eeeeee'
c.colors.hints.bg = '#427b58'
c.colors.hints.match.fg = '#eeeeee'

c.content.blocking.enabled = True

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

config.bind('si', 'hint images download')

config.bind('<Ctrl-p>', 'completion-item-focus --history prev', mode='command')
config.bind('<Ctrl-n>', 'completion-item-focus --history next', mode='command')

config.bind('gp', 'open -p')

config.bind('<Escape>', 'mode-leave ;; click-element id tampermonkey-decoy-clicker', mode='insert')
config.bind('<Escape>', 'click-element id tampermonkey-decoy-clicker', mode='normal')
config.bind(';m', 'hint links spawn --userscript ~/.local/bin/url2mpv.sh {hint-url} --from-browser "chromium:~/.local/share/qutebrowser"')
config.bind(',m', 'spawn --userscript ~/.local/bin/url2mpv.sh {url} --from-browser "chromium:~/.local/share/qutebrowser"')
config.bind('wt', 'jseval -q var el = document.getElementById("__qutebrowser_translation_trigger"); el.dataset.params = JSON.stringify({translationService: "microsoft-translator", microsoftApiKey: "1R6kkdpwnj7XUPaikG5hd2XfxmW2AbmmUPdC1GVaQJAd3j6T8TyHJQQJ99BJACi0881XJ3w3AAAbACOGdotm", microsoftRegion: "japaneast"}); el.click();')


WRAPPER_CLASS = '.text-region-wrapper'
TOGGLE_ID = '__qutebrowser_region_trigger'
EXTRACT_ID = '__qutebrowser_extract_trigger'
TEMP_ID = '__temp_hint_target'

START_MARKING = 'jseval -q document.getElementById("__qutebrowser_region_trigger");'
HINT_ACTION = f"element.id='{TEMP_ID}'; document.getElementById('{EXTRACT_ID}').click()"

# 3. 复制结果 (在 Hint 结束后，使用 :jseval -f 读取结果并复制)
COPY_RESULT = f"jseval -f qutebrowser.clipboard.setText(document.getElementById('{EXTRACT_ID}').dataset.result)"

# 绑定主 Hint 流程 (启用标记 -> Hint -> 提取/清理/复制)
config.bind(
    ',th', 
    f"click-element id __qutebrowser_region_trigger ;; hint text-regions",
    mode='normal'
)


# 手动关闭的绑定
config.bind(
    ',tf', 
    f"jseval -f document.getElementById('{TOGGLE_ID}').dataset.params = '{{\"forceState\": false}}'; document.getElementById('{TOGGLE_ID}').click()", 
    mode='normal'
)
