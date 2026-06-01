import type { GlobalConfig } from 'payload'

export const CareersPage: GlobalConfig = {
  slug: 'careers-page',
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
              defaultValue: 'Careers - DJI Luggage',
            },
            {
              name: 'hero',
              type: 'group',
              fields: [
                {
                  name: 'title',
                  type: 'textarea',
                  required: true,
                },
                {
                  name: 'descriptions',
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
          label: 'Team Photos',
          fields: [
            {
              name: 'teamPhotos',
              type: 'array',
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
                  defaultValue: 'Career image',
                },
              ],
              required: true,
            },
          ],
        },
        {
          label: 'Benefits',
          fields: [
            {
              name: 'benefitsIntro',
              type: 'group',
              fields: [
                {
                  name: 'bodyHtml',
                  type: 'code',
                  admin: {
                    language: 'html',
                  },
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
                  defaultValue: '',
                },
              ],
            },
            {
              name: 'benefits',
              type: 'array',
              fields: [
                {
                  name: 'number',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                },
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
        {
          label: 'Clock',
          fields: [
            {
              name: 'clock',
              type: 'group',
              fields: [
                {
                  name: 'locationLabel',
                  type: 'text',
                  defaultValue: 'Bogor',
                  required: true,
                },
                {
                  name: 'timeZone',
                  type: 'text',
                  defaultValue: 'Asia/Jakarta',
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
          label: 'Open Positions',
          fields: [
            {
              name: 'positionsHeading',
              type: 'text',
              defaultValue: 'Open Positions',
              required: true,
            },
            {
              name: 'positions',
              type: 'relationship',
              hasMany: true,
              relationTo: 'job-posts',
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
    en: 'Careers Page',
    zh: '招聘页',
  },
}
