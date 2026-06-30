import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
  },
  admin: {
    group: {
      en: 'Global',
      zh: '全局',
    },
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Brand',
          fields: [
            {
              name: 'brandName',
              type: 'text',
              defaultValue: 'DJI Luggage',
              required: true,
            },
            {
              name: 'logoLabel',
              type: 'text',
              defaultValue: 'DJI LUGGAGE',
              required: true,
            },
            {
              name: 'logoDisplay',
              type: 'select',
              defaultValue: 'text',
              options: [
                { label: 'Text', value: 'text' },
                { label: 'Image', value: 'image' },
              ],
              required: true,
            },
            {
              name: 'logoAlt',
              type: 'text',
              defaultValue: 'DJI Luggage',
            },
            {
              name: 'logoHref',
              type: 'text',
              defaultValue: '/',
            },
            {
              name: 'logoImage',
              type: 'upload',
              relationTo: 'media',
              admin: {
                condition: (_, siblingData) => siblingData?.logoDisplay === 'image',
                description: 'White PNG/SVG logo for dark or transparent header backgrounds.',
              },
            },
            {
              name: 'externalLogoImageUrl',
              type: 'text',
              defaultValue: '/assets/brand/dji-luggage-logo-white.png?v=20260601d',
              admin: {
                condition: (_, siblingData) => siblingData?.logoDisplay === 'image',
                description: 'White logo file URL. Used when no media upload is selected.',
              },
            },
            {
              name: 'darkLogoImage',
              type: 'upload',
              relationTo: 'media',
              admin: {
                condition: (_, siblingData) => siblingData?.logoDisplay === 'image',
                description: 'Black PNG/SVG logo for light headers, menu overlays, and footer.',
              },
            },
            {
              name: 'externalDarkLogoImageUrl',
              type: 'text',
              defaultValue: '/assets/brand/dji-luggage-logo-black.png?v=20260601d',
              admin: {
                condition: (_, siblingData) => siblingData?.logoDisplay === 'image',
                description: 'Black logo file URL. Used when no media upload is selected.',
              },
            },
            {
              name: 'requestQuoteLabel',
              type: 'text',
              defaultValue: 'Get a Quote',
              required: true,
            },
            {
              name: 'requestQuoteUrl',
              type: 'text',
              defaultValue: '/contact',
              required: true,
            },
          ],
        },
        {
          label: 'Header Menu',
          fields: [
            {
              name: 'mainNavigation',
              type: 'array',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'url',
                  type: 'text',
                  required: true,
                },
              ],
              required: true,
            },
            {
              name: 'menuContact',
              type: 'group',
              fields: [
                {
                  name: 'quickContactLabel',
                  type: 'text',
                  defaultValue: 'Quick Contact',
                },
                {
                  name: 'email',
                  type: 'email',
                  defaultValue: 'info@djiluggage.id',
                },
                {
                  name: 'messageLabel',
                  type: 'text',
                  defaultValue: 'Send Us A Message',
                },
                {
                  name: 'quoteLabel',
                  type: 'text',
                  defaultValue: 'Get a Quote',
                },
                {
                  name: 'quoteUrl',
                  type: 'text',
                  defaultValue: '/contact',
                },
              ],
            },
          ],
        },
        {
          label: 'Footer',
          fields: [
            {
              name: 'footerContact',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Contact',
                },
                {
                  name: 'heading',
                  type: 'text',
                  defaultValue: "Let's Get Started",
                },
                {
                  name: 'buttonLabel',
                  type: 'text',
                  defaultValue: 'Get a Quote',
                },
                {
                  name: 'buttonUrl',
                  type: 'text',
                  defaultValue: '/contact',
                },
              ],
            },
            {
              name: 'address',
              type: 'textarea',
              defaultValue:
                'JL RAYA PARUNG BOGOR,\nDESA/KELURAHAN KEMANG,\nKEC. KEMANG, KAB. BOGOR,\nPROVINSI JAWA BARAT,\nKODE POS: 16310',
            },
            {
              name: 'footerColumns',
              type: 'array',
              fields: [
                {
                  name: 'heading',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'links',
                  type: 'array',
                  fields: [
                    {
                      name: 'label',
                      type: 'text',
                      required: true,
                    },
                    {
                      name: 'url',
                      type: 'text',
                      required: true,
                    },
                  ],
                },
              ],
            },
            {
              name: 'socialLinks',
              type: 'array',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'url',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'icon',
                  type: 'select',
                  options: [
                    { label: 'LinkedIn', value: 'linkedin' },
                    { label: 'Instagram', value: 'instagram' },
                    { label: 'YouTube', value: 'youtube' },
                    { label: 'WhatsApp', value: 'whatsapp' },
                  ],
                  required: true,
                },
              ],
            },
            {
              name: 'copyright',
              type: 'text',
              defaultValue: '©2026 DJI Luggage. All rights reserved.',
            },
            {
              name: 'credit',
              type: 'text',
              defaultValue: 'Indonesian luggage manufacturer',
            },
          ],
        },
      ],
    },
  ],
  label: {
    en: 'Site Settings',
    zh: '站点设置',
  },
}
