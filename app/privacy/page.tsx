export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Ultimate Baseball Tool",
  description: "Privacy Policy for Ultimate Baseball Tool by UltimateBaseballTool.com",
};

export default function PrivacyPage() {
  const updated = "May 26, 2026";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-8">Last updated: {updated}</p>

        <section className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">1. Overview</h2>
            <p>
              Ultimate Baseball Tool ("the App") is operated by UltimateBaseballTool.com ("we," "us," or "our").
              This Privacy Policy explains how we handle information when you use our web application and Android app
              (package name: <span className="text-white font-mono">com.ultimatebaseballtool.app</span>).
              We are committed to protecting your privacy. This App does not require account creation or login for general use.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">2. Information We Do Not Collect</h2>
            <p>We do <strong className="text-white">not</strong> collect, store, or process:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Personal identification information (name, email address, phone number)</li>
              <li>User accounts or login credentials for general users</li>
              <li>Location or GPS data</li>
              <li>Payment or financial information</li>
              <li>Health or biometric data</li>
              <li>Contacts, messages, or communications</li>
              <li>Photos, media, or files from your device</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">3. Information Automatically Collected</h2>
            <p>When you use the App, standard web server logs may capture:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>IP address (anonymized)</li>
              <li>Browser type and version</li>
              <li>Pages visited and time spent</li>
              <li>Referring URL</li>
              <li>Device type (mobile, desktop)</li>
            </ul>
            <p className="mt-2">
              This information is used solely for diagnosing technical issues and improving App performance.
              It is never sold, rented, or shared with third parties for marketing purposes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">4. How We Use Information</h2>
            <p>Any information collected is used only to:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Operate and maintain the App</li>
              <li>Diagnose and fix technical issues</li>
              <li>Understand aggregate usage patterns to improve the experience</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">5. Baseball Data</h2>
            <p>
              All MLB statistical data, player information, bullpen health grades, and effectiveness ratings
              displayed in this App are sourced from publicly available baseball statistics and independently
              calculated by UltimateBaseballTool.com using our proprietary methodology. We do not sell,
              license, or share this data with third parties.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">6. Cookies</h2>
            <p>
              The App uses a single session cookie solely for authenticating the Admin section of the site.
              This cookie is not used for tracking, advertising, or analytics. General users of the App
              will not have any cookies set on their device.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">7. Third-Party Services</h2>
            <p>
              This App does not integrate third-party advertising networks, social media login services,
              data brokers, or tracking SDKs. All content is served directly from UltimateBaseballTool.com
              infrastructure hosted on Vercel. Baseball statistics are fetched from publicly available
              MLB data APIs.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">8. Data Sharing</h2>
            <p>
              We do not sell, trade, or otherwise transfer your information to outside parties.
              We do not share data with third parties except as required by law or to comply with
              a valid legal process.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">9. Data Security</h2>
            <p>
              We implement industry-standard security measures including HTTPS encryption for all
              data in transit. Admin access is protected by secure authentication. However, no method
              of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">10. Children&apos;s Privacy</h2>
            <p>
              This App is intended for users 18 years of age and older and is designed for adult sports
              analytics use. We do not knowingly collect any personal information from children under 13.
              If you believe a child under 13 has provided personal information through this App, please
              contact us immediately and we will delete it.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">11. Your Rights</h2>
            <p>Since we do not collect personal information from general users, there is no personal data to access, correct, or delete. If you have a specific privacy concern, contact us and we will respond within 30 days.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page
              with an updated revision date. Continued use of the App after changes are posted constitutes
              your acceptance of the updated policy.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">13. Contact Us</h2>
            <p>If you have any questions or concerns about this Privacy Policy, please contact us:</p>
            <p className="mt-2 text-white font-medium">
              Ultimate Baseball Tool<br />
              Website:{" "}
              <a href="https://ultimatebaseballtool.com" className="text-blue-400 hover:underline">
                ultimatebaseballtool.com
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
