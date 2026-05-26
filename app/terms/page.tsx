export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for MLB Bullpen Health Tracker by UltimateBaseballTool.com",
};

export default function TermsPage() {
  const updated = "May 15, 2025";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-8">Last updated: {updated}</p>

        <section className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using the MLB Bullpen Health Tracker application ("the App") provided by UltimateBaseballTool.com ("we," "us," or "our"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the App.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">2. Description of Service</h2>
            <p>The App provides baseball analytics data including MLB bullpen health ratings, pitcher workload tracking, effectiveness grades, and related statistics. All data is intended for informational and entertainment purposes only and is not intended for use in gambling, wagering, or fantasy sports platforms without explicit written permission.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">3. Data Accuracy</h2>
            <p>While we strive to provide accurate and up-to-date information, we do not guarantee the accuracy, completeness, or timeliness of any data displayed in the App. MLB statistics, injury reports, and player data are subject to change. UltimateBaseballTool.com is not responsible for decisions made based on data displayed in the App.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">4. Intellectual Property</h2>
            <p>All content, design, ratings methodology, grading algorithms, and code comprising this App are the intellectual property of UltimateBaseballTool.com. You may not reproduce, distribute, or create derivative works without express written permission. The proprietary Health and Effectiveness rating system is confidential and owned exclusively by UltimateBaseballTool.com.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">5. Permitted Use</h2>
            <p>You may use the App for personal, non-commercial purposes. You agree not to:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Scrape, harvest, or systematically download data from the App</li>
              <li>Use automated tools to access the App</li>
              <li>Reproduce or redistribute App content for commercial gain</li>
              <li>Attempt to reverse-engineer the rating methodology</li>
              <li>Use the App for any unlawful purpose</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">6. MLB Trademarks</h2>
            <p>Team names, logos, and other MLB trademarks referenced in this App are the property of Major League Baseball and its respective teams. UltimateBaseballTool.com is not affiliated with, endorsed by, or sponsored by Major League Baseball or any MLB team.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">7. Disclaimer of Warranties</h2>
            <p>The App is provided "as is" without warranties of any kind, either express or implied. We do not warrant that the App will be uninterrupted, error-free, or free of viruses. Use of the App is at your own risk.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">8. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, UltimateBaseballTool.com shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the App.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">9. Age Requirement</h2>
            <p>This App is intended for users 18 years of age and older. By using the App, you confirm that you are at least 18 years old.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">10. Changes to Terms</h2>
            <p>We reserve the right to modify these Terms at any time. Continued use of the App after changes are posted constitutes your acceptance of the revised Terms.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">11. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of the United States. Any disputes shall be resolved through binding arbitration.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">12. Contact</h2>
            <p>For questions about these Terms, contact us at:<br /><a href="https://ultimatebaseballtool.com" className="text-blue-400 hover:underline">ultimatebaseballtool.com</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
