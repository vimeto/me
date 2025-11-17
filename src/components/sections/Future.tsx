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
            <h3 className="font-bold text-lg mb-4">2026 Industry Internship</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Target: Foundation models team working on edge/cloud intelligence (e.g., Apple Zurich)
            </p>

            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-bold mb-2">Goals</h4>
                <ul className="space-y-2">
                  <li>• Ship a “cognitive core” prototype: small model, strong tool-use, minimal memorization</li>
                  <li>• Validate collaborative GRPO-style RL with on-device rollouts + cloud updates</li>
                  <li>• Deliver code + evals that teams can extend to production</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold mb-2">Timeline</h4>
                <ul className="space-y-2">
                  <li>• Dec 2025: ICDCS submission for collaborative fine-tuning (edge adapters + cloud backbones)</li>
                  <li>• Early 2026: GRPO-style RL manuscript; internship start</li>
                  <li>• Early 2027: PhD defense</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4">Long-term Vision</h3>
            <Separator className="mb-4 bg-border" />
            <p className="text-sm leading-relaxed">
              Build a deployable “cognitive core” that uses tools and retrieval to stay small, private,
              and responsive on billions of devices. Publish the empirical recipes—benchmarks, rollout
              tooling, and edge/cloud split patterns—that make that possible.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
