import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'
import { useState } from 'react'

const categories = ['All', 'Lab Notes', 'Production Incidents', 'Safety Deep Dives']

const posts = [
  {
    title: 'What oversight behaviors actually survive distillation?',
    category: 'Lab Notes',
    date: 'Coming Soon',
    description: 'Empirical analysis of safety transfer in model compression',
  },
  {
    title: 'MCPs + ChakIt: building tool-using agents without losing control',
    category: 'Lab Notes',
    date: 'Coming Soon',
    description:
      'Practical notes on Multi-Context Protocol agents with OpenAI’s new ChakIt toolkit: routing, guardrails, and latency on edge devices.',
  },
  {
    title: "Multilingual alignment: failures I've measured in the wild",
    category: 'Safety Deep Dives',
    date: 'Coming Soon',
    description: 'Cross-lingual safety evaluation results from production systems',
  },
  {
    title: 'Designing evals that survive deployment context shifts',
    category: 'Production Incidents',
    date: 'Coming Soon',
    description: 'Lessons from eval-production mismatches',
  },
]

export function Writing() {
  const [selectedCategory, setSelectedCategory] = useState('All')

  const filteredPosts =
    selectedCategory === 'All' ? posts : posts.filter((post) => post.category === selectedCategory)

  return (
    <section id="writing" className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold mb-8">WRITING</h2>
          <Separator className="mb-8 bg-border" />

          <div className="flex gap-4 mb-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`text-sm px-3 py-1 border transition-all ${
                  selectedCategory === category
                    ? 'border-2 border-foreground font-bold'
                    : 'border-border hover:border-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {filteredPosts.map((post, index) => (
              <motion.article
                key={post.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="border-b border-border pb-6"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg flex-1">{post.title}</h3>
                  <span className="text-sm text-muted-foreground">{post.date}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{post.category}</p>
                <p className="text-sm">{post.description}</p>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
