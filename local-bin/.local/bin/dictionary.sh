#!/usr/bin/env bash
set -euo pipefail

word="${1:-}"

if [[ -z "$word" ]]; then word="$(wl-paste --primary 2>/dev/null || true)"; fi
if [[ -z "$word" ]]; then word="$(wl-paste 2>/dev/null || true)"; fi

word="${word//$'\r'/}"
word="${word//$'\n'/}"
word="$(echo "$word" | sed 's/^[[:space:]]\+//; s/[[:space:]]\+$//')"

[[ -z "$word" ]] && notify-send -t 3000 "No text selected/copied." && exit 0

enc_word="$(printf %s "$word" | python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))')"
json="$(curl -fsS "https://api.dictionaryapi.dev/api/v2/entries/en_US/${enc_word}" 2>/dev/null || true)"

dict_ok=1
if [[ -z "$json" ]] || echo "$json" | jq -e 'type=="object" and .title? != null' >/dev/null 2>&1; then
  dict_ok=0
fi

tmp_dict="$(mktemp --suffix=".md" /tmp/dict.XXXXXX)"
tmp_zh="$(mktemp --suffix=".md" /tmp/dict-zh.XXXXXX)"
trap 'rm -f "$tmp_dict" "$tmp_zh"' EXIT

if [[ "$dict_ok" -eq 1 ]]; then
  echo "$json" | jq -r '
    .[0] as $e
    | "# \($e.word)\n"
    + (if ($e.phonetics|length)>0 then
        "## Phonetics\n"
        + ($e.phonetics
            | map("- " + ((.text // "") | select(length>0)) + (if (.audio//"") != "" then "  (audio: \(.audio))" else "" end))
            | map(select(. != "- "))
            | join("\n")
          ) + "\n\n"
      else "" end)
    + "## Meanings\n"
    + ($e.meanings | map(
        "### \(.partOfSpeech)\n"
        + (.definitions | to_entries | map(
            "- **\(.key+1).** \(.value.definition)\n"
            + (if (.value.example? // "") != "" then "  - example: \(.value.example)\n" else "" end)
            + (if (.value.synonyms|length)>0 then "  - synonyms: \((.value.synonyms|join(", ")))\n" else "" end)
            + (if (.value.antonyms|length)>0 then "  - antonyms: \((.value.antonyms|join(", ")))\n" else "" end)
          ) | join("\n"))
      ) | join("\n"))
    + "\n\n"
    + (if ($e.sourceUrls|length)>0 then
        "## Sources\n" + ($e.sourceUrls | map("- " + .) | join("\n")) + "\n"
      else "" end)
  ' > "$tmp_dict"
else
  {
    echo "# $word"
    echo
    echo "Dictionary: no entry found."
  } > "$tmp_dict"
fi

if command -v trans >/dev/null 2>&1; then
  zh="$(trans -b -no-ansi -s en -t zh-CN -- "$word" 2>/dev/null || true)"
  {
    echo "# 中文翻译"
    echo
    echo "原词：$word"
    echo
    [[ -n "$zh" ]] && echo "$zh" || echo "(翻译失败)"
  } > "$tmp_zh"
else
  {
    echo "未找到 translate-shell（trans）命令。"
  } > "$tmp_zh"
fi

TRANS_HEIGHT=8
foot -T floating_term -- nvim \
  +"setlocal nomodifiable" +"setlocal buftype=nowrite" +"setlocal bufhidden=wipe" "$tmp_dict" \
  +"split $tmp_zh" \
  +"resize ${TRANS_HEIGHT}" \
  +"setlocal winfixheight" \
  +"setlocal nomodifiable" +"setlocal buftype=nowrite" +"setlocal bufhidden=wipe"
