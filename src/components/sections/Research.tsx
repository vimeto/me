import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

const researchAreas = [
  {
    title: 'Distributed AI',
    question: 'How can we efficiently deploy AI models across edge devices?',
    method: 'Benchmarking inference on consumer hardware with various optimization techniques',
    output: 'Performance metrics and optimization guidelines',
  },
  {
    title: 'LLM Knowledge Transfer',
    question: 'What are the most effective methods for transferring knowledge between models?',
    method: 'Comparative analysis of distillation, fine-tuning, and adapter methods',
    output: 'Empirical evaluation framework',
  },
  {
    title: 'AI Safety',
    question: 'How do we ensure reliable and safe AI deployment in production?',
    method: 'Systematic evaluation of safety measures across deployment contexts',
    output: 'Safety evaluation metrics and best practices',
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
              I focus on making AI systems practical and safe for real-world deployment. My research
              spans distributed AI inference on edge devices, knowledge transfer between language models,
              and AI safety evaluation. I emphasize empirical methodology with reproducible benchmarks
              and real-world performance metrics.
            </p>
            <div className="mt-6 p-4 border border-border">
              <h4 className="font-bold text-sm mb-2">Papers in Review</h4>
              <ul className="text-sm space-y-1">
                <li>• Literature Review: AI Inference on Edge (180 references)</li>
                <li>• Measuring the True Cost of On-Device Agents (4 devices, 4 models, 300 tasks)</li>
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
