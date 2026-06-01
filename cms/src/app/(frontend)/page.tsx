import configPromise from '@payload-config'
import { getPayload } from 'payload'

export default async function HomePage() {
  const payload = await getPayload({ config: configPromise })

  let status = {
    aboutPage: 'not seeded',
    siteSettings: 'not seeded',
    teamMembers: 0,
    trustedLogos: 0,
  }

  try {
    const [siteSettings, aboutPage, teamMembers, trustedLogos] = await Promise.all([
      payload.findGlobal({ slug: 'site-settings' }),
      payload.findGlobal({ slug: 'about-page' }),
      payload.find({ collection: 'team-members', limit: 1 }),
      payload.find({ collection: 'trusted-logos', limit: 1 }),
    ])

    status = {
      aboutPage: aboutPage?.pageTitle ? 'ready' : 'not seeded',
      siteSettings: siteSettings?.brandName ? 'ready' : 'not seeded',
      teamMembers: teamMembers.totalDocs,
      trustedLogos: trustedLogos.totalDocs,
    }
  } catch {
    // The database may not exist yet before the first admin run.
  }

  return (
    <section className="cms-home">
      <div className="cms-shell">
        <p className="eyebrow">DJI Luggage CMS</p>
        <h1>One place to manage the website content.</h1>
        <p className="lede">
          This Payload workspace manages global navigation, footer content, marketing pages,
          team modules, trusted logos, testimonials, insights, careers, and contact submissions.
        </p>
        <div className="actions">
          <a href="/admin">Open Admin</a>
          <a href="/api/globals/home-page?depth=2">Home API</a>
        </div>
        <dl className="status-grid">
          <div>
            <dt>Site Settings</dt>
            <dd>{status.siteSettings}</dd>
          </div>
          <div>
            <dt>About Page</dt>
            <dd>{status.aboutPage}</dd>
          </div>
          <div>
            <dt>Team Members</dt>
            <dd>{status.teamMembers}</dd>
          </div>
          <div>
            <dt>Trusted Logos</dt>
            <dd>{status.trustedLogos}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
