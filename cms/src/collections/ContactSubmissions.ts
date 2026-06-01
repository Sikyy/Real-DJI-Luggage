import type { CollectionConfig } from 'payload'

const isLoggedIn = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

export const ContactSubmissions: CollectionConfig = {
  slug: 'contact-submissions',
  access: {
    create: () => true,
    read: isLoggedIn,
    update: isLoggedIn,
    delete: isLoggedIn,
  },
  admin: {
    defaultColumns: ['customerName', 'companyName', 'emailOrPhone', 'productType', 'status', 'createdAt'],
    group: {
      en: 'Content',
      zh: '内容',
    },
    useAsTitle: 'customerName',
  },
  fields: [
    {
      name: 'productType',
      type: 'text',
      label: {
        en: 'Product Type',
        zh: '产品类型',
      },
    },
    {
      name: 'orderQuantity',
      type: 'text',
      label: {
        en: 'Order Quantity',
        zh: '订单数量',
      },
    },
    {
      name: 'companyName',
      type: 'text',
      label: {
        en: 'Company Name',
        zh: '公司名称',
      },
    },
    {
      name: 'emailOrPhone',
      type: 'text',
      required: true,
      label: {
        en: 'Email / Phone',
        zh: '邮箱 / 电话',
      },
    },
    {
      name: 'customerName',
      type: 'text',
      label: {
        en: 'Name',
        zh: '姓名',
      },
    },
    {
      name: 'destinationMarket',
      type: 'text',
      label: {
        en: 'Destination Market',
        zh: '目标市场',
      },
    },
    {
      name: 'message',
      type: 'textarea',
      label: {
        en: 'Message',
        zh: '留言',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      admin: {
        readOnly: true,
      },
      label: {
        en: 'Source URL',
        zh: '来源页面',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Quoted', value: 'quoted' },
        { label: 'Closed', value: 'closed' },
      ],
      required: true,
      label: {
        en: 'Status',
        zh: '状态',
      },
    },
  ],
  labels: {
    plural: {
      en: 'Contact Submissions',
      zh: '询盘提交',
    },
    singular: {
      en: 'Contact Submission',
      zh: '询盘提交',
    },
  },
}
