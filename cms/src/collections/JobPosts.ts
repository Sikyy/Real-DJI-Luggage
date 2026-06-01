import type { CollectionConfig } from 'payload'

export const JobPosts: CollectionConfig = {
  slug: 'job-posts',
  access: {
    read: () => true,
  },
  admin: {
    defaultColumns: ['title', 'department', 'location', 'employmentType', 'isOpen'],
    group: {
      en: 'Content',
      zh: '内容',
    },
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'department',
      type: 'text',
      required: true,
    },
    {
      name: 'location',
      type: 'text',
      required: true,
    },
    {
      name: 'employmentType',
      type: 'select',
      defaultValue: 'full-time',
      options: [
        { label: 'Full Time', value: 'full-time' },
        { label: 'Part Time', value: 'part-time' },
        { label: 'Contract', value: 'contract' },
      ],
      required: true,
    },
    {
      name: 'postedDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
    },
    {
      name: 'sidebarText',
      type: 'textarea',
    },
    {
      name: 'jobDescription',
      type: 'textarea',
      required: true,
    },
    {
      name: 'responsibilities',
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
    {
      name: 'basicIntro',
      type: 'textarea',
    },
    {
      name: 'basicRequirements',
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
    {
      name: 'preferredIntro',
      type: 'textarea',
    },
    {
      name: 'preferredRequirements',
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
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Optional long-form content for future fully-rendered job pages.',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      required: true,
    },
    {
      name: 'isOpen',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  versions: {
    drafts: true,
  },
  labels: {
    plural: {
      en: 'Job Posts',
      zh: '招聘职位',
    },
    singular: {
      en: 'Job Post',
      zh: '招聘职位',
    },
  },
}
