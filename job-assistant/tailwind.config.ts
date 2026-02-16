import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
  	extend: {
  		keyframes: {
  			floatY: {
  				'0%, 100%': {
  					transform: 'translateY(0px)'
  				},
  				'50%': {
  					transform: 'translateY(-14px)'
  				}
  			},
  			popIn: {
  				'0%': {
  					transform: 'scale(0.9)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			},
  			chatReveal: {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(8px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			confettiDrop: {
  				'0%': {
  					transform: 'translate3d(0, -14vh, 0) rotate(0deg)',
  					opacity: '0'
  				},
  				'10%': {
  					opacity: '1'
  				},
  				'100%': {
  					transform: 'translate3d(0, 120vh, 0) rotate(720deg)',
  					opacity: '0.95'
  				}
  			},
  			confettiSway: {
  				'0%, 100%': {
  					marginLeft: '0px'
  				},
  				'50%': {
  					marginLeft: '18px'
  				}
  			},
  			auroraShift: {
  				'0%': {
  					backgroundPosition: '0% 50%'
  				},
  				'50%': {
  					backgroundPosition: '100% 50%'
  				},
  				'100%': {
  					backgroundPosition: '0% 50%'
  				}
  			}
  		},
  		animation: {
  			'float-y': 'floatY 2.8s ease-in-out infinite',
  			'pop-in': 'popIn 180ms ease-out',
  			'chat-reveal': 'chatReveal 280ms ease-out',
  			'confetti-drop': 'confettiDrop var(--dur,5s) linear infinite',
  			'confetti-sway': 'confettiSway var(--sway,2.5s) ease-in-out infinite',
  			aurora: 'auroraShift 12s ease-in-out infinite'
  		},
  		boxShadow: {
  			panel: '0 10px 28px rgba(15,23,42,0.08)'
  		},
  		colors: {
  			brand: {
  				'50': '#eff6ff',
  				'100': '#dbeafe',
  				'500': '#1d4ed8',
  				'600': '#1e40af'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
