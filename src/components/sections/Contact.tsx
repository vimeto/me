import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'
import { Mail, Github, Linkedin, Twitter, GraduationCap } from 'lucide-react'

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
    value: 'Department Page',
    href: 'https://www.helsinki.fi/en/about-us/people/people-finder',
    icon: GraduationCap,
  },
]

export function Contact() {
  return (
    <section id="contact" className="min-h-screen px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold mb-8">CONTACT</h2>
          <Separator className="mb-8 bg-border" />

          <div className="space-y-4">
            {contacts.map((contact, index) => {
              const Icon = contact.icon
              return (
                <motion.div
                  key={contact.label}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-4"
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-bold w-32">{contact.label}</span>
                  <a
                    href={contact.href}
                    target={contact.href.startsWith('mailto:') ? undefined : '_blank'}
                    rel={contact.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                    className="underline underline-offset-4 hover:font-bold transition-all"
                  >
                    {contact.value}
                  </a>
                </motion.div>
              )
            })}
          </div>

          <div className="mt-16 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              © {new Date().getFullYear()} Vilhelm Toivonen.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
