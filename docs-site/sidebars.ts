import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Quick Start',
      items: ['quickstart-web', 'quickstart-ios', 'quickstart-unity', 'quickstart-script-tags'],
    },
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/streams',
        'concepts/recordings',
        'concepts/highlights',
        'concepts/webhooks',
      ],
    },
    'api-reference',
    'sdk-reference',
    'monetization',
  ],
};

export default sidebars;
