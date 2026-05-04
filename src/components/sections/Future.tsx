import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'
import { SectionHeader } from '@/components/ui/section-header'

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
          <SectionHeader number="04" title="FUTURE" note="2026 – 2027" />

          <div className="border border-border p-8 mb-8">
            <h3 className="font-bold text-lg mb-4">Final research push</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Three threads to close the PhD: a journal extension of BridgeLoRA, an edge-mesh
              version of on-policy distillation, and a systems paper unifying the work.
            </p>

            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-bold mb-2">Goals</h4>
                <ul className="space-y-2">
                  <li>
                    • BridgeLoRA → journal extension: which layers, which adapters, which datasets —
                    mechanistic interpretability driving parameter efficiency
                  </li>
                  <li>
                    • Edge-mesh on-policy distillation: students and teachers split across devices,
                    clusters, and even model families
                  </li>
                  <li>
                    • Systems paper unifying BridgeLoRA, the measurement work, and the
                    scaffold-and-release framing (COLM submission) — PhD thesis spine
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold mb-2">Timeline</h4>
                <ul className="space-y-2">
                  <li>
                    • 2026: BridgeLoRA accepted at ICDCS; measurement paper submitted to MobiHoc;
                    on-policy distillation finding in writing
                  </li>
                  <li>
                    • Late 2026 – early 2027: edge-mesh distillation manuscript, BridgeLoRA journal
                    extension, systems paper draft
                  </li>
                  <li>• Early 2027: PhD defense and graduation</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4">Long-term Vision</h3>
            <Separator className="mb-4 bg-border" />
            <p className="font-serif text-base md:text-lg leading-relaxed">
              I’m not aiming to spend the next decade on fundamental research alone. The role I want
              combines the work I’ve already shipped — agentic systems, evaluations, production code
              — with the cognitive-core research I’m doing now, in a small high-agency team where
              the system actually reaches users. That research only matters if it’s built ground up:
              designed, distilled, trained from scratch, and deployed at scale, which takes real
              compute and a real team. Three years ago I set a ten-year goal of becoming one of the
              top hundred AI researchers in the world; seven years remain. I don’t know if I’ll get
              there, but I want to spend those years in a role where both my wins and my failures
              show up in something millions of people use every day.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
