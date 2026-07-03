import { motion } from 'framer-motion'
import { SectionHeader } from '@/components/ui/section-header'
import { RuleDraw } from '@/components/ui/rule-draw'
import { ArchitectureDiagram } from '@/components/sections/ArchitectureDiagram'
import { fadeRise, staggerChildren, viewportOnce } from '@/lib/motion'

const researchAreas = [
  {
    title: 'BridgeLoRA: Journal Extension',
    question: 'What does BridgeLoRA cost and leak in practice across the edge–cloud continuum?',
    method:
      'Extending the ICDCS 2026 result with systematic profiling, utility analysis, and honest privacy bounds (≥3311× perplexity blow-up to invert at ε=4)',
    output: 'IEEE TKDE submission',
  },
  {
    title: 'Exact-Fallback Expert Caching for MoE',
    question:
      'Does a higher expert-cache hit rate actually mean better output on offloaded MoE models?',
    method:
      "It doesn't: quality tracks miss severity, not hit rate. An exact-fallback kernel serves cache misses from CPU memory, so decode stays byte-identical to stock vLLM while a predictor prefetches ahead",
    output: '+10–19% decode throughput; targeting AAAI-27',
  },
  {
    title: 'Addressable Memory Banks',
    question:
      "Can a frozen model serve thousands of users' private facts without rereading them, and without leaking across users?",
    method:
      'Per-user rows in an addressable attention bank; strict gradient isolation makes deletion and access control exact, and multi-layer injection scales past a single write',
    output: 'Multi-tenant memory with provable isolation; targeting AAAI-27',
  },
]

export function Research() {
  return (
    <section id="research" className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <SectionHeader number="01" title="RESEARCH" note="2024 – 2026" />

          <div className="mb-12">
            <p className="font-serif text-lg leading-relaxed">
              I focus on distributed LLM inference and small, tool-using models that can live on
              devices. The goal: a “cognitive core” that reasons well, uses tools, and keeps most
              knowledge offloaded to retrieval instead of parameters. I got into ML early
              (high-school research on data augmentation for speech recognition) and I still work
              empirically: publishing benchmarks, code, and measurements on real consumer hardware
              (iPhone, MacBook, edge servers).
            </p>

            <ArchitectureDiagram />

            <div className="mt-6 p-4 border border-border/25">
              <h4 className="font-bold text-sm mb-2">Recent Papers</h4>
              <ul className="text-sm space-y-1">
                <li>
                  • BridgeLoRA: Privacy-preserving Collaborative Skip-Layer Connectors for Efficient
                  Transformer Fine-tuning at the Edge (accepted at ICDCS 2026)
                </li>
                <li>
                  • Where Should LLM Agents Run? Characterizing Costs of Mobile, Edge, and Cloud
                  Deployments (5 devices, 7 models, 8,400 trials; MobiHoc 2026 submission)
                </li>
                <li>
                  • Scaffold-and-Release: When Can We Remove the Teacher from KD-Augmented RLVR
                  Training? (COLM 2026 submission, in review)
                </li>
                <li>
                  • Foundation Model Inference at the Edge: survey (first author, ~240 references,
                  submitted to ACM Computing Surveys, July 2026)
                </li>
                <li>
                  • Efficient and Privacy-Preserving Large Language Model Inference at the Edge
                  (PerCom 2026 PhD Forum)
                </li>
              </ul>
            </div>

            <div className="mt-4 p-4 border border-border/25">
              <h4 className="font-bold text-sm mb-2">Theses</h4>
              <ul className="text-sm space-y-1">
                <li>
                  • Determining User Preference Profiles from Email And User Engagement Data (M.Sc.,
                  2024)
                </li>
                <li>• Lossless Compression of Deep Neural Networks (B.Sc., 2024)</li>
              </ul>
            </div>
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Current Agenda</h3>
          <RuleDraw className="h-px bg-foreground/60 mb-8" />

          <motion.div
            variants={staggerChildren(0.08)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="space-y-8"
          >
            {researchAreas.map((area) => (
              <motion.div
                key={area.title}
                variants={fadeRise}
                className="border border-border/60 p-6"
              >
                <h4 className="font-bold mb-4">{area.title}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-col gap-0.5 sm:flex-row">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:w-24 sm:flex-shrink-0 sm:pt-0.5">
                      Question:
                    </span>
                    <span className="text-sm flex-1">{area.question}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:w-24 sm:flex-shrink-0 sm:pt-0.5">
                      Method:
                    </span>
                    <span className="text-sm flex-1">{area.method}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:w-24 sm:flex-shrink-0 sm:pt-0.5">
                      Output:
                    </span>
                    <span className="text-sm flex-1">{area.output}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-12">
            <a
              href="https://scholar.google.com/citations?user=QnHmHssAAAAJ"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 decoration-1 hover:text-ink hover:decoration-ink transition-colors"
            >
              View Google Scholar Profile →
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
