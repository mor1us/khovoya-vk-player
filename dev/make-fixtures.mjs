// Генерирует 6 тестовых треков (40 с) для VK_MOCK=1.
import { execFileSync } from 'child_process'
import { mkdirSync, existsSync } from 'fs'
import ffmpeg from 'ffmpeg-static'
const dir = new URL('./fixtures/', import.meta.url).pathname
mkdirSync(dir, { recursive: true })
const chords = [[220, 277, 330], [247, 311, 370], [196, 247, 294], [262, 330, 392], [175, 220, 262], [233, 294, 349]]
chords.forEach((c, i) => {
  const out = `${dir}tone${i}.mp3`
  if (existsSync(out)) return
  const expr = c.map((f, k) => `0.18*sin(2*PI*${f}*t)*(0.6+0.4*sin(2*PI*${0.5 + k * 0.25}*t))`).join('+') + `+0.12*sin(2*PI*${c[0] / 2}*t)*lt(mod(t,0.5),0.12)`
  execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', `aevalsrc='${expr}':s=44100:d=40`, '-af', 'afade=t=in:d=1,afade=t=out:st=38:d=2', '-b:a', '192k', out], { stdio: 'ignore' })
})
console.log('fixtures ok', dir)
