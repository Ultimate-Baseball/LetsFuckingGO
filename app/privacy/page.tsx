export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for MLB Bullpen Health Tracker by UltimateBaseballTool.com",
};

export default function PrivacyPage() {
  const updated = "May 15, 2025";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-8">Last updated: {updated}</p>

        <section className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">1. Overview</h2>
            <p>MLB Bullpen Health Tracker ("the App") is operated by UltimateBaseballTool.com ("we," "us," or "our"). This Privacy Policy explains how we handle information when you use our web application and Android app. We are committed to protecting your privacy. This app does not require account creation or login for general use.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">2. Information We Do Not Collect</h2>
            <p>We do <strong className="text-white">not</strong> collect, store, or process:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Personal identification information (name, email, address)</li>
              <li>User accounts or login credentials (for general users)</li>
              <li>Location data</li>
              <li>Payment information</li>
              <li>Health or biometric data</li>
              <li>Contacts or communications</li>
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
            </ul>
            <p className="mt-2">This information is used solely for diagnosing technical issues and improving app performance. It is not sold or shared with third parties.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">4. Analytics</h2>
            <p>We may use anonymized analytics tools to understand aggregate usage patterns (e.g., which teams are most viewed). No personally identifiable information is used in this process.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">5. Baseball Data</h2>
            <p>All MLB statistical data, player information, and team data displayed in this App is sourced from publicly available baseball statistics and manually curated by UltimateBaseballTool.com. We do not sell or license this data to third parties.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">6. Cookies</h2>
            <p>The App uses a single session cookie solely for authenticating the Admin section. This cookie is not used for tracking or advertising. General users of the App will not have any cookies set.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">7. Children's Privacy</h2>
            <p>This App is intended for users 18 years of age and older. We do not knowingly collect information from children under 13. If you believe a child has provided us with personal information, please contact us immediately.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">8. Third-Party Services</h2>
            <p>This App does not integrate third-party advertising networks, social login services, or data brokers. All content is served directly from UltimateBaseballTool.com infrastructure.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">9. Data Security</h2>
            <p>We implement industry-standard security measures to protect any data processed through the App. Admin access is protected by secure authentication. However, no method of transmission over the internet is 100% secure.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of the App after changes constitutes acceptance of the updated policy.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us at:</p>
            <p className="mt-2 text-white font-medium">UltimateBaseballTool.com<br />Website: <a href="https://ultimatebaseballtool.com" className="text-blue-400 hover:underline">ultimatebaseballtool.com</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
