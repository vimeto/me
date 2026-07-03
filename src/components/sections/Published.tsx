import { motion } from 'framer-motion'
import { SectionHeader } from '@/components/ui/section-header'
import { fadeRise, staggerChildren, viewportOnce } from '@/lib/motion'

interface Paper {
  year: string
  venue: string
  title: string
  authors: string
  summary: string
  page: string
  code?: string
  image: string
  imageAlt: string
}

const papers: Paper[] = [
  {
    year: '2026',
    venue: 'ICDCS 2026 · accepted',
    title:
      'BridgeLoRA: Privacy-preserving Collaborative Skip-Layer Connectors for Efficient Transformer Fine-tuning at the Edge',
    authors: 'Vilhelm Toivonen, Xiang Su, Xiaoli Liu, Sasu Tarkoma, Pan Hui',
    summary:
      'Skip connectors bridge d > 1 frozen transformer layers, cutting edge-cloud synchronization from O(L) to O(L/d) while every task-specific parameter stays on-device. Outperforms standard LoRA (1.47 vs 1.66 validation loss on Llama-3.2-3B) while training 2.7% of parameters.',
    page: 'https://vimeto.github.io/bridge-lora/',
    code: 'https://github.com/vimeto/bridge-lora',
    image: '/published/bridge-lora-page.png',
    imageAlt:
      'The BridgeLoRA interactive paper page: title, authors, and links to video, code, and paper',
  },
]

export function Published() {
  return (
    <section id="published" className="px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <SectionHeader number="02" title="PUBLISHED" note="peer-reviewed" />

        <motion.div
          variants={staggerChildren(0.08)}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          {papers.map((paper) => (
            <motion.article
              key={paper.title}
              variants={fadeRise}
              className="border-t-2 border-foreground/80 py-8"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <div className="font-mono text-xs text-muted-foreground tabular-nums">
                  {paper.year}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-ink">
                  {paper.venue}
                </div>
              </div>

              <h3 className="font-serif text-2xl md:text-3xl leading-tight mt-2 max-w-3xl">
                <a
                  href={paper.page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink transition-colors"
                >
                  {paper.title}&nbsp;→
                </a>
              </h3>
              <p className="text-sm text-muted-foreground mt-2">{paper.authors}</p>
              <p className="text-sm leading-relaxed max-w-2xl mt-3">{paper.summary}</p>

              <a
                href={paper.page}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open the interactive paper page for ${paper.title}`}
                className="group mt-6 block border border-border/60 transition-colors hover:border-ink"
              >
                <img
                  src={paper.image}
                  alt={paper.imageAlt}
                  width={1400}
                  height={540}
                  loading="lazy"
                  className="block w-full select-none saturate-[0.92] transition-[filter] duration-300 group-hover:saturate-100 dark:brightness-95"
                />
                <span className="flex items-center justify-between border-t border-border/60 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-ink">
                  <span>Interactive paper page · video · figures · code</span>
                  <span aria-hidden>→</span>
                </span>
              </a>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <a
                  href={paper.page}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 decoration-1 hover:text-ink hover:decoration-ink transition-colors"
                >
                  Paper page →
                </a>
                {paper.code && (
                  <a
                    href={paper.code}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 decoration-1 hover:text-ink hover:decoration-ink transition-colors"
                  >
                    Code →
                  </a>
                )}
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
