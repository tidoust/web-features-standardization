import webFeatures from 'web-features';
import webSpecs from 'web-specs/index.json' assert { type: 'json' };
import assert from 'assert';

// A W3C specification starts becoming stable when it becomes a
// Candidate Recommendation.
const interoperableStatuses = [
  'Recommendation',
  'Proposed Recommendation'
];
const stableStatuses = [
  'Candidate Recommendation Snapshot',
  'Candidate Recommendation Draft'
].concat(interoperableStatuses);

// Divergences that may be worth looking into:
// - late incubations contains well-supported features for which the underlying
// W3C spec is still in incubation phase (not yet published under /TR)
// - late working drafts contains well-supported features for which the
// underlying W3C spec is on the Recommendation track, but not yet a
// Candidate Recommendation.
// - late implementations contains not-so-well-supported features for which the
// underlying W3C spec is a Proposed Recommendation or Recommendation.
const worthChecking = {
  lateIncubation: {
    high: [],
    low: [],
    false: []
  },
  lateWorkingDrafts: {
    high: [],
    low: [],
    false: []
  },
  lateImplementations: {
    high: [],
    low: [],
    false: []
  }
};

function recordPossibleAnomalies(anomaly, feature, baseline, specs) {
  for (const spec of specs) {
    worthChecking[anomaly][baseline].push({
      feature,
      spec: {
        shortname: spec.shortname,
        url: spec.url
      }
    });
  }
}



for (const [feature, desc] of Object.entries(webFeatures)) {
  if (!desc.status) {
    continue;
  }

  // Look for related spec entries in web-specs
  assert(desc.spec, `"${feature}" does not link to any spec`);
  const urls = Array.isArray(desc.spec) ? desc.spec : [desc.spec];
  const specs = webSpecs.filter(s =>
    urls.find(url => url.startsWith(s.nightly?.url)) ||
    urls.find(url => url.startsWith(s.release?.url)) ||
    urls.find(url => url.startsWith(s.url)));
  assert(specs.length > 0, `No spec found in web-specs for "${feature}"`);

  // We're only interested in W3C specs for now
  const w3cSpecs = specs.filter(s => s.organization === 'W3C');

  if ([false, 'low', 'high'].includes(desc.status.baseline)) {
    // Assess whether feature is well supported or not-so-well supported.
    if (desc.status.baseline === false) {
      const codebases = new Set();
      for (const browser of Object.keys(desc.status.support)) {
        const codebase = browser === 'edge' ? 'chrome' : browser.split('_')[0];
        codebases.add(codebase);
      }
      if (codebases.size <= 1) {
        recordPossibleAnomalies(
          'lateImplementations',
          feature, desc.status.baseline,
          w3cSpecs.filter(spec =>
            spec.release &&
            interoperableStatuses.includes(spec.release.status))
        );
        continue;
      }
    }

    recordPossibleAnomalies(
      'lateIncubation',
      feature, desc.status.baseline,
      w3cSpecs.filter(spec => !spec.release)
    );

    recordPossibleAnomalies(
      'lateWorkingDrafts',
      feature, desc.status.baseline,
      w3cSpecs.filter(spec =>
        spec.release &&
        !stableStatuses.includes(spec.release.status))
    );
  }
}

const formatList = (title, list) => {
  if (list.length === 0) {
    return '';
  }
  const markdownList = list
    .map(f => `- \`${f.feature}\` in spec [${f.spec.shortname}](${f.spec.url})`)
    .join('\n');
  return `
<details>
    <summary>${title} (${list.length})</summary>

${markdownList}
</details>
  `;
};

const formatAnomalies = anomaly => {
  const markdown =
    formatList('Baseline high features', worthChecking[anomaly].high) +
    formatList('Baseline low features', worthChecking[anomaly].low) +
    formatList('Non-Baseline features', worthChecking[anomaly][false]);
  return markdown || '\n*No problems found.*';
};

console.log(`
## Late incubations?

Well-supported features defined in W3C specs that are still at an incubation
phase.
${formatAnomalies('lateIncubation')}

## Worth publishing as Candidate Recommendation?

Well-supported features defined in W3C specs that are still Working Drafts.
${formatAnomalies('lateWorkingDrafts')}

## Missing implementations?

Not-so-well supported features defined in W3C specs that are already
Recommendation (or Proposed Recommendation).
${formatAnomalies('lateImplementations')}
`);