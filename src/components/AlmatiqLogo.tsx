'use client';

export default function AlmatiqLogo({ size = "base" }: { size?: "base" | "small" }) {
    const isSmall = size === "small";
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isSmall ? '2px' : '6px', textAlign: 'center', userSelect: 'none', padding: isSmall ? '0' : '1rem 0' }}>
            <div style={{
                fontSize: isSmall ? '1.2rem' : '2.6rem',
                fontWeight: 300,
                letterSpacing: isSmall ? '4px' : '12px',
                color: '#fff',
                textShadow: '0 0 25px rgba(255,255,255,0.4)',
                fontFamily: 'Outfit, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
            }}>
                <span style={{ fontWeight: 400, marginRight: isSmall ? '-2px' : '-6px' }}>Λ</span>LMATIQ
            </div>
            <div style={{
                fontSize: isSmall ? '0.28rem' : '0.6rem',
                fontWeight: 700,
                letterSpacing: isSmall ? '1.5px' : '4px',
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                marginTop: isSmall ? '2px' : '4px'
            }}>
                Where Science Touches Soul
            </div>
        </div>
    );
}
