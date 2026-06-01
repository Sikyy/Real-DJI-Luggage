import type { CollectionConfig } from 'payload'

export const Testimonials: CollectionConfig = {
  slug: 'testimonials',
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ['company', 'sortOrder', 'isActive'],
    group: {
      en: 'About',
      zh: '关于',
    },
    useAsTitle: 'company',
  },
  fields: [
    {
      name: 'quote',
      type: 'textarea',
      required: true,
    },
    {
      name: 'company',
      type: 'text',
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
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  labels: {
    plural: {
      en: 'Testimonials',
      zh: '客户评价',
    },
    singular: {
      en: 'Testimonial',
      zh: '客户评价',
    },
  },
}
