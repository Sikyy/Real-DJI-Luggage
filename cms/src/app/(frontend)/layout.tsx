import React from 'react'
import './styles.css'

export const metadata = {
  description: 'DJI Luggage website content management workspace.',
  title: 'DJI Luggage CMS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
