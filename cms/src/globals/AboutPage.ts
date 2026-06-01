import type { GlobalConfig } from 'payload'

export const AboutPage: GlobalConfig = {
  slug: 'about-page',
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
              defaultValue: 'About - DJI Luggage',
            },
            {
              name: 'pageTitle',
              type: 'text',
              required: true,
            },
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'externalHeroImageUrl',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          label: 'Who We Are',
          fields: [
            {
              name: 'whoWeAre',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Who We Are',
                  required: true,
                },
                {
                  name: 'heading',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'columns',
                  type: 'array',
                  fields: [
                    {
                      name: 'body',
                      type: 'textarea',
                      required: true,
                    },
                  ],
                  required: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Reach',
          fields: [
            {
              name: 'reach',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Our Reach',
                  required: true,
                },
                {
                  name: 'heading',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'locations',
                  type: 'array',
                  fields: [
                    {
                      name: 'country',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'city',
                      type: 'text',
                      required: true,
                    },
                  ],
                  required: true,
                },
                {
                  name: 'globeVideoUrl',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          label: 'Metrics',
          fields: [
            {
              name: 'metrics',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Key Metrics',
                  required: true,
                },
                {
                  name: 'heading',
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
                },
                {
                  name: 'imageAlt',
                  type: 'text',
                  defaultValue: 'person on computer',
                },
                {
                  name: 'subtext',
                  type: 'textarea',
                },
                {
                  name: 'items',
                  type: 'array',
                  fields: [
                    {
                      name: 'value',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'label',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'tone',
                      type: 'select',
                      defaultValue: 'dark',
                      options: [
                        { label: 'Dark', value: 'dark' },
                        { label: 'Gray', value: 'gray' },
                        { label: 'Yellow', value: 'yellow' },
                        { label: 'Charcoal', value: 'charcoal' },
                      ],
                      required: true,
                    },
                  ],
                  required: true,
                },
              ],
            },
          ],
        },
        {
          label: 'Social Proof',
          fields: [
            {
              name: 'testimonials',
              type: 'relationship',
              hasMany: true,
              relationTo: 'testimonials',
            },
            {
              name: 'trustedLabel',
              type: 'text',
              defaultValue: 'Trusted By',
              required: true,
            },
            {
              name: 'trustedLogos',
              type: 'relationship',
              hasMany: true,
              relationTo: 'trusted-logos',
            },
          ],
        },
        {
          label: 'Team',
          fields: [
            {
              name: 'teamLabel',
              type: 'text',
              defaultValue: 'Our Team',
              required: true,
            },
            {
              name: 'teamHeading',
              type: 'text',
              defaultValue: 'Leadership',
              required: true,
            },
            {
              name: 'teamMembers',
              type: 'relationship',
              hasMany: true,
              relationTo: 'team-members',
            },
          ],
        },
        {
          label: 'CTAs',
          fields: [
            {
              name: 'careersCta',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Careers',
                },
                {
                  name: 'heading',
                  type: 'textarea',
                },
                {
                  name: 'buttonLabel',
                  type: 'text',
                  defaultValue: 'Explore Careers',
                },
                {
                  name: 'buttonUrl',
                  type: 'text',
                  defaultValue: '/careers',
                },
              ],
            },
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
    en: 'About Page',
    zh: '关于页',
  },
}
