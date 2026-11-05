/**
 * Your 24/7 link: https://<your-name>.github.io/<repo>/
 *
 * Waits until GitHub has really published your latest save (it reads the version stamped
 * into the live page), then shows the link with a QR code, copies it to your clipboard
 * so you can paste it into WhatsApp or anywhere, and opens it in your browser, already refreshed.
 *
 *   npm run live    (or double-click live-link.bat)   show and open the link now
 *   node scripts/livelink.mjs --wait <commit>          wait for that save to go live first
 *   add --no-open to skip opening the browser
 */
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import qrcodeTerminal from 'qrcode-terminal'

const args = process.argv.slice(2)
const POLL_MS = Number(process.env.LUNAR_POLL_MS) || 15000
const LIMIT_MS = Number(process.env.LUNAR_WAIT_MS) || 12 * 60 * 1000
const API = process.env.LUNAR_API || 'https://api.github.com'
const say = msg => console.log(`  [24/7 link] ${msg}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const git = a => (spawnSync('git', a, { encoding: 'utf8' }).stdout || '').trim()

function repoInfo() {
  let url = process.env.LUNAR_GH_URL
  if (!url) {
    try {
      const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
      url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
    } catch { /* no package.json */ }
  }
  if (!url) url = git(['remote', 'get-url', 'origin'])
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url || '')
  if (!m) return null
  return { owner: m[1], name: m[2], site: process.env.LUNAR_SITE || `https://${m[1].toLowerCase()}.github.io/${m[2]}/` }
}

/** The version stamped into the live page by vite.config.ts, or null. */
async function liveVersion(site) {
  const res = await fetch(`${site}?check=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
  if (!res.ok) return null
  return /name="lunar-build" content="([0-9a-f]{7,40})"/.exec(await res.text())?.[1] ?? null
}

/** If GitHub's tests or publishing failed for this save, the link to the failed run. */
async function failedRun(r, sha) {
  const get = async path => {
    const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'lunar-scout' } })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    return res.json()
  }
  const runs = (await get(`/repos/${r.owner}/${r.name}/actions/runs?head_sha=${sha}&per_page=5`)).workflow_runs ?? []
  const run = runs[0]
  if (!run || run.status !== 'completed' || run.conclusion === 'success') return null
  const jobs = (await get(`/repos/${r.owner}/${r.name}/actions/runs/${run.id}/jobs`)).jobs ?? []
  const deploy = jobs.find(j => j.name === 'deploy')
  return deploy?.conclusion === 'success' ? null : run.html_url // a failed QR step alone doesn't stop the site
}

function copyAndOpen(text, url) {
  const quiet = { stdio: ['pipe', 'ignore', 'ignore'] }
  if (process.platform === 'win32') spawnSync('clip', [], { ...quiet, input: text })
  else if (process.platform === 'darwin') spawnSync('pbcopy', [], { ...quiet, input: text })
  else spawnSync('xclip', ['-selection', 'clipboard'], { ...quiet, input: text })
  if (args.includes('--no-open')) return
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]
  const child = spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
}

function announce(site, sha) {
  const line = '═'.repeat(Math.max(48, site.length + 6))
  console.log(`\n  ${line}\n     YOUR SITE IS LIVE 24/7\n     ${site}\n     Copied to your clipboard: paste it anywhere to share.\n     Works on any phone or computer, even when this one is off.\n  ${line}\n`)
  qrcodeTerminal.generate(site, { small: true }, q => console.log(q.replace(/^/gm, '     ')))
  copyAndOpen(site, sha ? `${site}?v=${sha.slice(0, 7)}` : site)
}

async function main() {
  const r = repoInfo()
  if (!r) return say('This folder is not linked to a GitHub repo yet, so there is no 24/7 link.')
  const wait = args.includes('--wait')
  const sha = args.find(a => /^[0-9a-f]{40}$/.test(a)) ?? git(['rev-parse', 'HEAD'])
  if (wait && sha) {
    say('GitHub is testing and publishing your update. The link appears here when it is live (about 2 to 3 minutes).')
    let useApi = true
    const t0 = Date.now()
    for (let i = 0; ; i++) {
      if ((await liveVersion(r.site).catch(() => null)) === sha) break
      if (useApi && i % 4 === 3) {
        try {
          const failed = await failedRun(r, sha)
          if (failed) return say(`GitHub could not publish this update, so your site still shows the last working version. See why: ${failed}`)
        } catch { useApi = false } // rate-limited or offline: keep checking the site itself
      }
      if (Date.now() - t0 > LIMIT_MS) return say(`Not live after ${Math.round(LIMIT_MS / 60000)} minutes. Check https://github.com/${r.owner}/${r.name}/actions. Your link: ${r.site}`)
      await sleep(POLL_MS)
    }
  }
  announce(r.site, sha)
}

main().catch(e => say(`Skipped: ${e.message}`))
