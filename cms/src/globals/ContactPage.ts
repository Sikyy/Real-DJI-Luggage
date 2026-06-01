import type { GlobalConfig } from 'payload'

export const ContactPage: GlobalConfig = {
  slug: 'contact-page',
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
              defaultValue: 'Contact - DJI Luggage',
            },
            {
              name: 'hero',
              type: 'group',
              fields: [
                {
                  name: 'email',
                  type: 'email',
                  defaultValue: 'info@djiluggage.id',
                },
                {
                  name: 'title',
                  type: 'text',
                  defaultValue: 'Contact Us',
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
                  admin: {
                    description: 'Keep the current image here until the final DJI Luggage imagery is ready.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Form',
          fields: [
            {
              name: 'form',
              type: 'group',
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  defaultValue: 'Your Info',
                },
                {
                  name: 'title',
                  type: 'text',
                  defaultValue: 'Request a Quote',
                },
                {
                  name: 'fields',
                  type: 'array',
                  fields: [
                    {
                      name: 'placeholder',
                      type: 'text',
                      required: true,
                    },
                  ],
                  required: true,
                },
                {
                  name: 'messagePlaceholder',
                  type: 'text',
                  defaultValue: 'Message',
                },
                {
                  name: 'submitLabel',
                  type: 'text',
                  defaultValue: 'Send Inquiry',
                },
                {
                  name: 'successMessage',
                  type: 'text',
                  defaultValue: 'Inquiry sent. We will contact you shortly.',
                },
                {
                  name: 'errorMessage',
                  type: 'text',
                  defaultValue: 'Unable to send right now. Please try again or email us directly.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  label: {
    en: 'Contact Page',
    zh: '联系页',
  },
}
