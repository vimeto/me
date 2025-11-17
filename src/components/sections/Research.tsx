import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

const researchAreas = [
  {
    title: 'Cognitive Core',
    question: 'How do we build compact models that reason well and use tools instead of memorizing facts?',
    method: 'Train/evaluate small models with retrieval + tool-use scaffolds; stress-test reasoning vs. recall',
    output: 'Blueprint for tool-using “cognitive core” models deployable on devices',
  },
  {
    title: 'Edge/Cloud Collaboration',
    question: 'What’s the right split between on-device adapters and server backbones for privacy + speed?',
    method: 'Adapters that can skip transformer layers on-device while frozen backbones run in the cloud',
    output: 'Latency/quality tradeoff studies and open-source reference pipelines',
  },
  {
    title: 'RL for Agents on Devices',
    question: 'How can we run RL (GRPO-style) efficiently with on-device rollouts and verifiable rewards?',
    method: 'Asynchronous rollout collection on edge hardware, off-policy updates in the cloud',
    output: 'Benchmarks + recipes for on-device agent training',
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
          <div className="flex justify-between items-baseline mb-8">
            <h2 className="text-2xl font-bold">RESEARCH</h2>
            <span className="text-sm text-muted-foreground">2024-2025</span>
          </div>
          <Separator className="mb-8 bg-border" />

          <div className="mb-12">
            <p className="text-lg leading-relaxed">
              I focus on distributed LLM inference and small, tool-using models that can live on devices.
              The goal: a “cognitive core” that reasons well, uses tools, and keeps most knowledge offloaded
              to retrieval instead of parameters. I got into ML early—high-school research on data augmentation
              for speech recognition—and I still work empirically: publishing benchmarks, code, and measurements
              on real consumer hardware (iPhone, MacBook, edge servers).
            </p>
            <div className="mt-6 p-4 border border-border">
              <h4 className="font-bold text-sm mb-2">Papers in Review</h4>
              <ul className="text-sm space-y-1">
                <li>• LLM Inference on Edge — Survey (first author, 180 references, submitted Nov 2025)</li>
                <li>• Measuring the True Cost of On-Device Agents (4 devices, 4 models, 300 tasks — PerCom 2026 submission)</li>
                <li>• Collaborative Fine-Tuning: Edge Adapters + Cloud Backbones (ICDCS Dec 2025 submission)</li>
              </ul>
            </div>

            <div className="mt-4 p-4 border border-border">
              <h4 className="font-bold text-sm mb-2">Theses</h4>
              <ul className="text-sm space-y-1">
                <li>• Determining User Preference Profiles from Email And User Engagement Data (M.Sc., 2024)</li>
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
              className="underline underline-offset-4 hover:font-bold transition-all"
            >
              View Google Scholar Profile →
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
