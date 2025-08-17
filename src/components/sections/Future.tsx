import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

export function Future() {
  return (
    <section id="future" className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold mb-8">FUTURE</h2>
          <Separator className="mb-8 bg-border" />

          <div className="border border-border p-8 mb-8">
            <h3 className="font-bold text-lg mb-4">Anthropic AI Safety Fellows Program</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Target: October 2025 Cohort (London/Remote UK/Ontario Canada)
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm mb-2">Fellowship Focus (8-24 weeks)</h4>
                <ul className="space-y-2 text-sm">
                  <li>• Develop evaluation framework for distributed AI deployment</li>
                  <li>• Study knowledge transfer methods between model architectures</li>
                  <li>• Create safety benchmarks for edge AI systems</li>
                  <li>• Release reproducible evaluation tools with full documentation</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-sm mb-2">Research Questions</h4>
                <ol className="space-y-2 text-sm list-decimal list-inside">
                  <li>How can we efficiently deploy AI models on edge devices?</li>
                  <li>What are the safety implications of distributed AI systems?</li>
                  <li>How do we ensure knowledge transfer preserves safety properties?</li>
                </ol>
              </div>

              <div>
                <h4 className="font-bold text-sm mb-2">Proposed Mentorship Areas</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Distributed systems and edge AI</li>
                  <li>• Model compression and optimization</li>
                  <li>• Safety evaluation methodologies</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4">Long-term Vision</h3>
            <Separator className="mb-4 bg-border" />
            <p className="text-sm leading-relaxed">
              Build empirical foundations for safe model compression and deployment. Create
              reproducible evaluation frameworks that bridge the gap between research and
              production. Contribute to making AI systems reliably safe across all deployment
              contexts and languages.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
