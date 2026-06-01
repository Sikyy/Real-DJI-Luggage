import type { GlobalConfig } from 'payload'

export const PlatformPage: GlobalConfig = {
  slug: 'platform-page',
  access: {
    read: () => true,
  },
  admin: {
    group: {
      en: 'Pages',
      zh: '页面',
    },
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Hero',
          fields: [
            {
              name: 'metaTitle',
              type: 'text',
              defaultValue: 'Capabilities - DJI Luggage',
            },
            {
              name: 'hero',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Capabilities',
                  required: true,
                },
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'description',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'backgroundImage',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'externalBackgroundImageUrl',
                  type: 'text',
                  required: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Interface',
          fields: [
            {
              name: 'interfaceIntro',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Production Workflow',
                  required: true,
                },
                {
                  name: 'body',
                  type: 'textarea',
                  required: true,
                },
              ],
            },
            {
              name: 'tabletMockup',
              type: 'group',
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'externalImageUrl',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'imageAlt',
                  type: 'text',
                  defaultValue: 'Manufacturing planning dashboard',
                },
              ],
            },
          ],
        },
        {
          label: 'Feature Sections',
          fields: [
            {
              name: 'featureSections',
              type: 'array',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'heading',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'body',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'externalImageUrl',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'imageAlt',
                  type: 'text',
                  required: true,
                },
              ],
              required: true,
            },
          ],
        },
        {
          label: 'Why Choose',
          fields: [
            {
              name: 'whyChoose',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Why Choose Us',
                  required: true,
                },
                {
                  name: 'body',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'backgroundImage',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'externalBackgroundImageUrl',
                  type: 'text',
                  required: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Highlights',
          fields: [
            {
              name: 'highlights',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Features',
                  required: true,
                },
                {
                  name: 'heading',
                  type: 'text',
                  defaultValue: 'Platform Highlights',
                  required: true,
                },
                {
                  name: 'items',
                  type: 'array',
                  fields: [
                    {
                      name: 'number',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'body',
                      type: 'textarea',
                      required: true,
                    },
                    {
                      name: 'icon',
                      type: 'upload',
                      relationTo: 'media',
                    },
                    {
                      name: 'externalIconUrl',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'iconAlt',
                      type: 'text',
                      defaultValue: '',
                    },
                  ],
                  required: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Final CTA',
          fields: [
            {
              name: 'finalCta',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: "Let's Get To Work",
                },
                {
                  name: 'heading',
                  type: 'textarea',
                },
                {
                  name: 'buttonLabel',
                  type: 'text',
                  defaultValue: 'Contact Us',
                },
                {
                  name: 'buttonUrl',
                  type: 'text',
                  defaultValue: '/contact',
                },
                {
                  name: 'backgroundImage',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'externalBackgroundImageUrl',
                  type: 'text',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  label: {
    en: 'Platform Page',
    zh: '平台页',
  },
}
