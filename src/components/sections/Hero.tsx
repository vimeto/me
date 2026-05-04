import { motion, useScroll, useTransform } from 'framer-motion'
import { Separator } from '@/components/ui/separator'

export function Hero() {
  const { scrollY } = useScroll()
  const portraitY = useTransform(scrollY, [0, 700], [0, -42], { clamp: true })
  const ruleY = useTransform(scrollY, [0, 700], [0, -18], { clamp: true })

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 md:pb-24 md:pt-32"
    >
      <div className="mx-auto grid min-h-[calc(100vh-13rem)] w-full max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,390px)] lg:gap-0">
        <motion.div
          className="relative z-10 max-w-3xl lg:pr-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-8 flex items-end gap-5 lg:block">
            <img
              src="/avatar.png"
              alt="Portrait of Vilhelm Toivonen"
              width={128}
              height={128}
              draggable={false}
              className="block w-32 flex-shrink-0 select-none lg:hidden"
            />
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-ink">
                AI systems researcher | Builder
              </p>
              <h1 className="font-serif text-[clamp(2.65rem,10vw,6.35rem)] font-normal leading-[0.88] tracking-normal lg:max-w-[720px]">
                Vilhelm
                <br />
                Toivonen
              </h1>
            </div>
          </div>

          <p className="mb-5 max-w-2xl font-serif text-xl leading-snug md:text-2xl">
            Distributed LLMs — cognitive core, edge deployment, and tool-using agents.
          </p>

          <p className="mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Doctoral Researcher (distributed LLM inference), University of Helsinki
            <br />
            Consulting AI Architect, Bondata
            <br />
            Founder, Teknet (2019) • Co-founder, Padlo.co (2025)
          </p>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">
              CURRENT FOCUS <span className="font-normal text-muted-foreground ml-4">2026</span>
            </h2>
            <Separator className="bg-border" />
            <ul className="space-y-2 text-lg">
              <li>
                • BridgeLoRA: distributed fine-tuning across edge adapters and cloud backbones
                (ICDCS 2026)
              </li>
              <li>• On-policy distillation: removing the teacher early without quality loss</li>
              <li>
                • Edge inference for small models: predictive MoE routing and additive hierarchical
                memory
              </li>
            </ul>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3">
            <a
              href="#research"
              className="underline underline-offset-4 decoration-1 hover:text-ink hover:decoration-ink transition-colors"
            >
              Research Agenda
            </a>
            <a
              href="mailto:vilhelm.toivonen@helsinki.fi"
              className="underline underline-offset-4 decoration-1 hover:text-ink hover:decoration-ink transition-colors"
            >
              Email
            </a>
            <a
              href="https://www.linkedin.com/in/vilhelm-toivonen-80405516a/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 decoration-1 hover:text-ink hover:decoration-ink transition-colors"
            >
              LinkedIn
            </a>
            <a
              href="https://scholar.google.com/citations?user=QnHmHssAAAAJ"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 decoration-1 hover:text-ink hover:decoration-ink transition-colors"
            >
              Scholar
            </a>
          </div>
        </motion.div>

        <motion.figure
          className="relative hidden self-stretch lg:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          aria-label="Portrait of Vilhelm Toivonen"
        >
          <motion.div
            style={{ y: ruleY }}
            className="absolute bottom-[15%] left-0 top-[6%] w-px bg-foreground/70"
          />
          <motion.img
            src="/avatar.png"
            alt=""
            width={600}
            height={600}
            draggable={false}
            initial={{ opacity: 0, filter: 'blur(10px) saturate(0.75)' }}
            animate={{ opacity: 1, filter: 'blur(0px) saturate(0.82)' }}
            transition={{ duration: 1.0, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ y: portraitY }}
            className="absolute bottom-[15%] left-[-92px] w-[min(48vw,560px)] max-w-none select-none object-contain drop-shadow-[0_28px_42px_rgb(0_0_0_/_0.16)] dark:drop-shadow-[0_26px_44px_rgb(255_255_255_/_0.08)]"
          />
        </motion.figure>
      </div>
    </section>
  )
}
