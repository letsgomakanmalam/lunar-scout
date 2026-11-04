/**
 * Saves your work to GitHub every time you start the site (npm run dev or start-dev.bat),
 * and whenever you run `npm run sync` or double-click sync-github.bat.
 *
 *   1. Commits every change in this folder, with the date and time as the message.
 *   2. Pulls anything new from GitHub first, so the push isn't rejected.
 *   3. Pushes. GitHub Actions then tests the code and republishes the live site.
 *
 * It never stops the site from starting: if Git is missing, you're offline, or GitHub
 * needs you to sign in, it says so and carries on. Set LUNAR_AUTOPUSH=0 to switch it off.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'

const say = msg => console.log(`  [GitHub] ${msg}`)
const git = (args, opts = {}) => spawnSync('git', args, { encoding: 'utf8', ...opts })
const ok = r => r.status === 0
const out = r => (r.stdout || '').trim()

function repoUrl() {
  if (process.env.LUNAR_REPO) return process.env.LUNAR_REPO
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    return typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? null
  } catch {
    return null
  }
}

function pagesUrl(url) {
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(\.git)?$/.exec(url ?? '')
  return m ? `https://${m[1].toLowerCase()}.github.io/${m[2]}/` : null
}

function main() {
  if (process.env.CI) return // never inside GitHub Actions
  if (process.env.LUNAR_AUTOPUSH === '0') return say('Auto-save is switched off (LUNAR_AUTOPUSH=0).')
  if (!ok(git(['--version']))) return say('Git is not installed, so nothing was saved to GitHub. Get it from https://git-scm.com/download/win and run again.')
  const url = repoUrl()

  // A folder that was downloaded or unzipped rather than cloned: link it to the GitHub repo once.
  if (!ok(git(['rev-parse', '--is-inside-work-tree']))) {
    if (!url) return say('This folder is not linked to a GitHub repo yet. Add "repository" to package.json.')
    say(`Linking this folder to ${url}`)
    if (!ok(git(['init', '-q', '-b', 'main']))) { git(['init', '-q']); git(['symbolic-ref', 'HEAD', 'refs/heads/main']) }
    git(['remote', 'add', 'origin', url])
    if (!ok(git(['fetch', '-q', 'origin'], { timeout: 60000 }))) {
      rmSync('.git', { recursive: true, force: true })
      return say('Could not reach GitHub to link this folder. Nothing was changed; it will try again next time.')
    }
    if (ok(git(['rev-parse', '-q', '--verify', 'origin/main']))) {
      // Take GitHub's history but keep every file in this folder exactly as it is.
      git(['update-ref', 'refs/heads/main', 'origin/main'])
      git(['reset', '-q'])
      // Files that exist only on GitHub are kept, not deleted.
      const missing = out(git(['ls-files', '--deleted'])).split('\n').filter(Boolean)
      if (missing.length) git(['checkout', '--', ...missing])
    }
  }

  // Commits need a name and email. If none is set, use the GitHub account's private noreply address.
  if (!out(git(['config', 'user.email']))) {
    const owner = /github\.com[/:]([^/]+)\//.exec(url ?? '')?.[1] ?? 'lunar-scout'
    git(['config', 'user.name', owner])
    git(['config', 'user.email', `${owner}@users.noreply.github.com`])
  }

  git(['add', '-A'])
  if (ok(git(['diff', '--cached', '--quiet']))) {
    say('No new changes since the last save.')
  } else {
    const stamp = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    if (!ok(git(['commit', '-q', '-m', `Auto update ${stamp}`]))) return say('Could not save a commit. Run "git status" to see why.')
    say(`Saved your changes as "Auto update ${stamp}".`)
  }

  if (!out(git(['remote']))) {
    if (!url) return say('No GitHub repo is linked, so nothing was pushed.')
    git(['remote', 'add', 'origin', url])
  }
  const branch = out(git(['symbolic-ref', '--short', 'HEAD'])) || 'main'

  // Bring in anything that changed on GitHub first.
  if (ok(git(['ls-remote', '--exit-code', '--heads', 'origin', branch], { timeout: 30000 }))) {
    if (!ok(git(['pull', '-q', '--rebase', '--autostash', 'origin', branch], { timeout: 90000 }))) {
      if (existsSync('.git/rebase-merge') || existsSync('.git/rebase-apply')) {
        git(['rebase', '--abort'])
        return say('GitHub has edits to the same lines you changed, so they could not be combined automatically. Your work is safe on this computer.')
      }
      return say('Could not reach GitHub (offline?). Your changes are saved on this computer and will be pushed next time.')
    }
  }

  if (ok(git(['push', '-q', '-u', 'origin', branch], { stdio: 'inherit', timeout: 300000 }))) {
    const site = pagesUrl(url ?? out(git(['remote', 'get-url', 'origin'])))
    say(`Pushed to GitHub.${site ? ` The live site updates in about 2 to 3 minutes: ${site}` : ''}`)
  } else {
    say('Could not push (offline, or GitHub needs you to sign in). Your changes are saved on this computer and will be pushed next time.')
  }
}

try {
  main()
} catch (e) {
  say(`Skipped saving to GitHub: ${e.message}`)
}
