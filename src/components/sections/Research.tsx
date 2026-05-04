import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'
import { SectionHeader } from '@/components/ui/section-header'
import { ArchitectureDiagram } from '@/components/sections/ArchitectureDiagram'

const researchAreas = [
  {
    title: 'BridgeLoRA — Journal Extension',
    question:
      'Which transformer layers benefit most from per-task adapters, and where can frozen backbones still serve?',
    method:
      'Extending the ICDCS 2026 result with mechanistic interpretability — which layers, which adapters, which datasets — so adapter placement is principled, not heuristic',
    output:
      'Journal paper with concrete parameter-efficiency recipes; reference pipelines for layer-targeted adaptation',
  },
  {
    title: 'Predictive MoE Routing',
    question:
      'Can a lightweight predictor running alongside a Mixture-of-Experts model speed up its inference on edge devices?',
    method:
      'Anticipate which experts the model will dispatch to, prefetch the relevant weights, and pre-stage the routing path so memory bandwidth on consumer hardware stops being the bottleneck',
    output: 'Latency improvements that make MoE feasible for on-device deployment',
  },
  {
    title: 'Hierarchical Memory Bank',
    question:
      'Can a small language model gain reliable, composable memory by injecting trainable deltas into its residual stream?',
    method:
      'Different fact types target different transformer layers; memories compose additively, so banks can stack on top of one another; tested on hierarchically organized data',
    output:
      'A modular memory architecture that scales by addition rather than retraining the base model',
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
              knowledge offloaded to retrieval instead of parameters. I got into ML
              early—high-school research on data augmentation for speech recognition—and I still
              work empirically: publishing benchmarks, code, and measurements on real consumer
              hardware (iPhone, MacBook, edge servers).
            </p>

            <ArchitectureDiagram />

            <div className="mt-6 p-4 border border-border">
              <h4 className="font-bold text-sm mb-2">Recent Papers</h4>
              <ul className="text-sm space-y-1">
                <li>
                  • BridgeLoRA: Privacy-preserving Collaborative Skip-Layer Connectors for Efficient
                  Transformer Fine-tuning at the Edge — accepted at ICDCS 2026
                </li>
                <li>
                  • Measuring the True Cost of On-Device Agents (4 devices, 4 models, 300 tasks) —
                  MobiHoc 2026 submission
                </li>
                <li>
                  • Scaffold-and-Release: When Can We Remove the Teacher from RLVR Training? — COLM
                  2026 submission
                </li>
                <li>
                  • LLM Inference on Edge — Survey (first author, 180 references, in review since
                  April 2026)
                </li>
              </ul>
            </div>

            <div className="mt-4 p-4 border border-border">
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
          <Separator className="mb-8 bg-border" />

          <div className="space-y-8">
            {researchAreas.map((area, index) => (
              <motion.div
                key={area.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="border border-border p-6"
              >
                <h4 className="font-bold mb-4">{area.title}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-bold w-20">Question:</span>
                    <span className="flex-1">{area.question}</span>
                  </div>
                  <div className="flex">
                    <span className="font-bold w-20">Method:</span>
                    <span className="flex-1">{area.method}</span>
                  </div>
                  <div className="flex">
                    <span className="font-bold w-20">Output:</span>
                    <span className="flex-1">{area.output}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

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
