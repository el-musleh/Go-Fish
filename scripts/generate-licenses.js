/**
 * Generate licenses.json from package.json dependencies
 * Usage: node scripts/generate-licenses.js
 */

const fs = require('fs');
const path = require('path');

// Common license mappings
const LICENSE_MAP = {
  'MIT': 'MIT',
  'ISC': 'ISC',
  'Apache-2.0': 'Apache 2.0',
  'Apache-2': 'Apache 2.0',
  'BSD-2-Clause': 'BSD 2-Clause',
  'BSD-3-Clause': 'BSD 3-Clause',
  'BSD-4-Clause': 'BSD 4-Clause',
  'GPL-3.0': 'GPL v3',
  'GPL-3': 'GPL v3',
  'GPL-2.0': 'GPL v2',
  'GPL-2': 'GPL v2',
  'LGPL-3.0': 'LGPL v3',
  'MPL-2.0': 'MPL 2.0',
  'CC0-1.0': 'CC0 1.0',
  'CC-BY-4.0': 'CC BY 4.0',
  'Unlicense': 'Public Domain',
  '0BSD': 'BSD Zero Clause',
  'Zlib': 'Zlib',
  'Python-2.0': 'Python 2.0',
};

// Known packages with custom licenses or that need manual mapping
const KNOWN_LICENSES = {
  'react': { license: 'MIT', publisher: 'Meta (Facebook)' },
  'react-dom': { license: 'MIT', publisher: 'Meta (Facebook)' },
  'react-router': { license: 'MIT', publisher: 'React Router Team' },
  'react-router-dom': { license: 'MIT', publisher: 'React Router Team' },
  '@supabase/supabase-js': { license: 'Apache 2.0', publisher: 'Supabase' },
  '@radix-ui/react-dialog': { license: 'MIT', publisher: 'Radix UI' },
  '@radix-ui/react-dropdown-menu': { license: 'MIT', publisher: 'Radix UI' },
  '@radix-ui/react-select': { license: 'MIT', publisher: 'Radix UI' },
  '@radix-ui/react-toast': { license: 'MIT', publisher: 'Radix UI' },
  'lucide-react': { license: 'ISC', publisher: 'Lucide' },
  'tailwindcss': { license: 'MIT', publisher: 'Tailwind Labs' },
  'vite': { license: 'MIT', publisher: 'Vite Team' },
  'express': { license: 'MIT', publisher: 'Express Team' },
  'pg': { license: 'MIT', publisher: 'Brian Carlson' },
  '@langchain/openrouter': { license: 'MIT', publisher: 'LangChain' },
  '@langchain/core': { license: 'MIT', publisher: 'LangChain' },
  'langgraph': { license: 'MIT', publisher: 'LangChain' },
};

function normalizeLicense(license) {
  if (!license) return 'Unknown';
  const normalized = license.toString().trim();
  return LICENSE_MAP[normalized] || normalized;
}

function getLicenseInfo(packageName, packageJson) {
  // Check known licenses first
  const known = KNOWN_LICENSES[packageName];
  if (known) return known;

  // Parse from package.json
  let license = 'Unknown';
  if (packageJson.license) {
    license = normalizeLicense(packageJson.license);
  } else if (packageJson.licenses && Array.isArray(packageJson.licenses)) {
    license = packageJson.licenses.map(l => normalizeLicense(l.type || l)).join(' AND ');
  }

  return {
    license,
    publisher: packageJson.author?.name || null,
  };
}

function getDependencies(packageJson) {
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
}

function loadPackageJson(dir) {
  try {
    return require(path.join(dir, 'package.json'));
  } catch {
    return null;
  }
}

function main() {
  const rootDir = path.join(__dirname, '..');
  const clientDir = path.join(rootDir, 'client');
  const outputFile = path.join(rootDir, 'public', 'licenses.json');

  const licenses = [];

  // Process root package.json
  const rootPkg = loadPackageJson(rootDir);
  if (rootPkg) {
    const deps = getDependencies(rootPkg);
    Object.keys(deps).forEach(pkg => {
      licenses.push({
        name: pkg,
        version: deps[pkg].replace(/[\^~>=<]/g, ''),
        ...getLicenseInfo(pkg, {}),
      });
    });
  }

  // Process client package.json
  const clientPkg = loadPackageJson(clientDir);
  if (clientPkg) {
    const deps = getDependencies(clientPkg);
    Object.keys(deps).forEach(pkg => {
      const existing = licenses.find(l => l.name === pkg);
      if (existing) {
        existing.version = deps[pkg].replace(/[\^~>=<]/g, '');
      } else {
        licenses.push({
          name: pkg,
          version: deps[pkg].replace(/[\^~>=<]/g, ''),
          ...getLicenseInfo(pkg, {}),
        });
      }
    });
  }

  // Sort alphabetically
  licenses.sort((a, b) => a.name.localeCompare(b.name));

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to file
  fs.writeFileSync(outputFile, JSON.stringify(licenses, null, 2));
  console.log(`Generated ${outputFile} with ${licenses.length} packages`);
}

main();
