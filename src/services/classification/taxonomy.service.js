/**
 * taxonomy.service.js
 * Domain taxonomy hierarchy, subcategory trees, SLAs, and keyword mapping.
 */

const TAXONOMY_HIERARCHY = {
  Network: {
    subcategories: ['VPN', 'DNS', 'Firewall', 'LAN / Switch', 'WiFi', 'Routing'],
    slaHours: { P1: 1, P2: 4, P3: 12, P4: 24 },
    keywords: ['vpn', 'globalprotect', 'disconnect', 'dns', 'gateway', 'packet', 'latency', 'bandwidth', 'ip', 'subnet']
  },
  'Access & Identity': {
    subcategories: ['Account Lockout', 'Password Reset', 'MFA / Authenticator', 'Active Directory', 'SSO / Okta', 'Permissions'],
    slaHours: { P1: 1, P2: 4, P3: 8, P4: 24 },
    keywords: ['locked', 'password', 'mfa', 'authenticator', 'permission', '4625', 'access denied', 'active directory', 'sso']
  },
  Hardware: {
    subcategories: ['Workstation / Laptop', 'Monitor / Display', 'Docking Station', 'Printer / Peripheral', 'Disk / Memory'],
    slaHours: { P1: 2, P2: 8, P3: 24, P4: 48 },
    keywords: ['laptop', 'screen', 'monitor', 'dock', 'printer', 'keyboard', 'blue screen', 'overheating', 'battery']
  },
  Software: {
    subcategories: ['Developer Tools', 'CAD / Engineering', 'Productivity Suite', 'OS / Patching', 'Antivirus / Endpoint Security'],
    slaHours: { P1: 1, P2: 6, P3: 16, P4: 48 },
    keywords: ['autocad', 'install', 'update', 'crash', '0x80070005', 'license', 'excel', 'intune', 'crowdstrike']
  },
  'Server & Infrastructure': {
    subcategories: ['Web Server', 'Database Cluster', 'Virtual Machine', 'Kubernetes / Container', 'Storage / SAN', 'Cloud Services'],
    slaHours: { P1: 0.5, P2: 2, P3: 8, P4: 24 },
    keywords: ['502 bad gateway', 'nginx', 'oom', 'cpu 100%', 'database', 'postgres', 'mongo', 'node', 'cluster', 'pod']
  },
  'Email & Collaboration': {
    subcategories: ['Outlook / Exchange', 'Teams / Zoom', 'SharePoint / OneDrive', 'Spam / Phishing', 'Distribution Lists'],
    slaHours: { P1: 2, P2: 6, P3: 16, P4: 48 },
    keywords: ['outlook', 'email', 'undelivered', 'mailbox', 'teams', 'meeting', 'phishing', 'onedrive', 'sync']
  }
};

class TaxonomyService {
  getCategories() {
    return Object.keys(TAXONOMY_HIERARCHY);
  }

  getSubcategories(category) {
    return TAXONOMY_HIERARCHY[category]?.subcategories || [];
  }

  getSlaHours(category, priority) {
    return TAXONOMY_HIERARCHY[category]?.slaHours?.[priority] || 24;
  }

  suggestCategoryFromText(text) {
    if (!text || typeof text !== 'string') return { category: 'Software', confidence: 0.5 };
    const lower = text.toLowerCase();

    let bestCategory = 'Software';
    let maxMatches = 0;

    for (const [cat, data] of Object.entries(TAXONOMY_HIERARCHY)) {
      const matchCount = data.keywords.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0);
      if (matchCount > maxMatches) {
        maxMatches = matchCount;
        bestCategory = cat;
      }
    }

    const confidence = maxMatches > 0 ? Math.min(0.95, 0.4 + maxMatches * 0.15) : 0.4;
    return { category: bestCategory, confidence: Number(confidence.toFixed(2)) };
  }
}

const taxonomyService = new TaxonomyService();

module.exports = {
  TaxonomyService,
  taxonomyService,
  TAXONOMY_HIERARCHY
};
