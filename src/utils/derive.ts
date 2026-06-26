import type { Node, Usage } from '../types'

export function deriveUsage(node: Node): Usage {
  const d = node.dynamic
  const memUsed = d?.used_memory ?? 0
  const memTotal = d?.total_memory ?? 0
  const diskTotal = d?.total_space ?? 0
  const diskUsed = diskTotal && d?.available_space != null ? diskTotal - d.available_space : 0
  return {
    cpu: d?.cpu_usage,
    mem: memTotal ? (memUsed / memTotal) * 100 : undefined,
    memUsed,
    memTotal,
    disk: diskTotal ? (diskUsed / diskTotal) * 100 : undefined,
    diskUsed,
    diskTotal,
    netIn: d?.receive_speed,
    netOut: d?.transmit_speed,
    uptime: d?.uptime,
    ts: d?.timestamp,
  }
}

export function displayName(node: Node) {
  return node.meta?.name || node.static?.system?.system_host_name || node.uuid.slice(0, 8)
}

export function cpuLabel(node: Node) {
  const cpu = node.static?.cpu
  const cores = cpu?.physical_cores ?? cpu?.per_core?.length
  const brand = cpu?.brand || cpu?.per_core?.[0]?.brand || ''
  const parts: string[] = []
  if (cores) parts.push(`${cores} 核`)
  if (brand) parts.push(brand)
  return parts.join(' · ')
}

export function osLabel(node: Node) {
  const s = node.static?.system
  if (!s) return ''
  if (s.system_os_long_version) return s.system_os_long_version.replace(/^Linux /i, '').replace(/\(([^)]*)\)/g, '$1').trim()
  return [s.system_name?.replace(/^Linux$/i, '').trim(), s.system_os_version || s.system_version].filter(Boolean).join(' ')
}

const LOGO_BASE = `${import.meta.env.BASE_URL}linux-logo-icon/`
const VENDOR_BASE = `${import.meta.env.BASE_URL}vendor-logo-icon/`

const VENDORS = [
  { file: 'dmit.svg', match: ['dmit'] },
  { file: 'oracle.svg', match: ['oracle'] },
  { file: 'terabix.svg', match: ['terabix'] },
  { file: 'greencloud.svg', match: ['green'] },
  { file: 'akile.svg', match: ['akile'] },
  { file: 'locvps.svg', match: ['locvps'] },
]

const DISTROS = [
  { file: 'archlinux.svg', match: ['arch'] },
  { file: 'manjaro.svg', match: ['manjaro'] },
  { file: 'kali.svg', match: ['kali'] },
  { file: 'ubuntu.svg', match: ['ubuntu'] },
  { file: 'mint.svg', match: ['mint'] },
  { file: 'debian.svg', match: ['debian'] },
  { file: 'alpinelinux-icon.svg', match: ['alpine'] },
  { file: 'fedora.svg', match: ['fedora'] },
  { file: 'rocky.svg', match: ['rocky'] },
  { file: 'oracle.svg', match: ['oracle'] },
  { file: 'redhat.svg', match: ['red hat', 'redhat', 'rhel', 'almalinux'] },
  { file: 'centos.svg', match: ['centos'] },
  { file: 'gentoo.svg', match: ['gentoo'] },
  { file: 'nixos.svg', match: ['nix'] },
  { file: 'zorin.svg', match: ['zorin'] },
  { file: 'freebsd.svg', match: ['freebsd', 'bsd'] },
  { file: 'windows.svg', match: ['windows', 'microsoft'] },
]

export function distroLogo(node: Node) {
  const s = node.static?.system
  const hay = [s?.distribution_id, s?.system_name, s?.system_os_version, s?.system_version]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .trim()
  if (!hay) return ''
  for (const { file, match } of DISTROS) {
    if (match.some(k => hay.includes(k))) return `${LOGO_BASE}${file}`
  }
  return `${LOGO_BASE}linux.svg`
}

export function vendorLogo(node: Node) {
  const name = (node.meta?.name || '').toLowerCase().trim()
  if (!name) return ''
  for (const { file, match } of VENDORS) {
    if (match.some(k => name.includes(k))) return `${VENDOR_BASE}${file}`
  }
  return ''
}

const LETTER_COLORS = ['#e63946','#f4a261','#e9c46a','#2a9d8f','#287271','#6d597a','#b5838d','#1d3557']

export function letterIcon(node: Node): string {
  const name = displayName(node)
  const letter = name.trim().charAt(0).toUpperCase() || '?'
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const color = LETTER_COLORS[hash % LETTER_COLORS.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="46" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="38" fill="#fff">${letter}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const VIRT_LABELS: Record<string, string> = {
  kvm: 'KVM',
  lxc: 'LXC',
  openvz: 'OpenVZ',
  vmware: 'VMware',
  hyperv: 'Hyper-V',
  'hyper-v': 'Hyper-V',
  xen: 'Xen',
  docker: 'Docker',
  wsl: 'WSL',
  dedicated: '独服',
}

function normalizeVirt(raw: string) {
  const key = raw.toLowerCase().trim()
  if (!key || key === 'none') return ''
  return VIRT_LABELS[key] || raw
}

export function virtLabel(node: Node) {
  const fromKv = node.meta?.virtualization
  if (fromKv) {
    const v = normalizeVirt(String(fromKv))
    if (v) return v
  }
  const fromApi = node.static?.system?.virtualization
  if (fromApi) {
    const v = normalizeVirt(String(fromApi))
    if (v) return v
  }
  return detectVirt(node)
}

function detectVirt(node: Node) {
  const s = node.static?.system
  const cpu = node.static?.cpu
  const kernel = (s?.system_kernel_version || s?.system_kernel || '').toLowerCase()
  const brand = (cpu?.brand || cpu?.per_core?.[0]?.brand || '').toLowerCase()

  if (kernel.includes('microsoft') || kernel.includes('wsl')) return 'WSL'
  if (kernel.includes('pve')) return 'Proxmox'
  if (brand.includes('hyper-v') || brand.includes('microsoft hyper')) return 'Hyper-V'
  if (brand.includes('vmware')) return 'VMware'
  if (brand.includes('xen')) return 'Xen'
  if (brand.includes('kvm') || brand.includes('qemu')) return 'KVM'
  if (/-aws|-azure|-gcp|-oracle/.test(kernel)) return 'KVM'
  return ''
}
