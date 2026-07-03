import { motion } from 'framer-motion'
import { Mail, Github, Linkedin, Twitter, GraduationCap } from 'lucide-react'
import { SectionHeader } from '@/components/ui/section-header'
import { fadeRise, staggerChildren, viewportOnce } from '@/lib/motion'

const contacts = [
  {
    label: 'Email',
    value: 'vilhelm.toivonen@helsinki.fi',
    href: 'mailto:vilhelm.toivonen@helsinki.fi',
    icon: Mail,
  },
  {
    label: 'GitHub',
    value: 'vimeto',
    href: 'https://github.com/vimeto',
    icon: Github,
  },
  {
    label: 'LinkedIn',
    value: 'Vilhelm Toivonen',
    href: 'https://www.linkedin.com/in/vilhelm-toivonen-80405516a/',
    icon: Linkedin,
  },
  {
    label: 'Twitter/X',
    value: '@ToivonenVilhelm',
    href: 'https://twitter.com/ToivonenVilhelm',
    icon: Twitter,
  },
  {
    label: 'Google Scholar',
    value: 'Publications',
    href: 'https://scholar.google.com/citations?user=QnHmHssAAAAJ',
    icon: GraduationCap,
  },
  {
    label: 'University',
    value: 'Research Portal',
    href: 'https://researchportal.helsinki.fi/fi/persons/vilhelm-toivonen/',
    icon: GraduationCap,
  },
]

export function Contact() {
  return (
    <section id="contact" className="px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <SectionHeader number="07" title="CONTACT" />

          <motion.div
            variants={staggerChildren(0.06)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="space-y-4"
          >
            {contacts.map((contact) => {
              const Icon = contact.icon
              return (
                <motion.div
                  key={contact.label}
                  variants={fadeRise}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/25 pb-3"
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-bold w-32 flex-shrink-0">{contact.label}</span>
                  <a
                    href={contact.href}
                    target={contact.href.startsWith('mailto:') ? undefined : '_blank'}
                    rel={contact.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                    className="underline underline-offset-4 decoration-1 hover:text-ink hover:decoration-ink transition-colors break-all"
                  >
                    {contact.value}
                  </a>
                </motion.div>
              )
            })}
          </motion.div>

          <div className="mt-16 pt-8 border-t border-border/25">
            <p className="text-sm text-muted-foreground text-center">
              © {new Date().getFullYear()} Vilhelm Toivonen.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
