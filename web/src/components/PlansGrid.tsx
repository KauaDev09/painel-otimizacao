import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API, type Plan } from '../lib/api';
import { brl, featureLabel } from '../lib/format';

type PlansGridProps = {
  featuredSlug?: string;
  priceSuffix?: string;
  longLabels?: boolean;
};

export default function PlansGrid({
  featuredSlug = 'ultra',
  priceSuffix = '/ mês',
  longLabels = false,
}: PlansGridProps) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    API.get<{ plans: Plan[] }>('/api/v1/public/plans')
      .then((data) => setPlans(data.plans || []))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <p className="muted text-center">
        Não foi possível carregar os planos. Tente novamente em instantes.
      </p>
    );
  }

  if (!plans) {
    return (
      <div className="plans">
        <div className="plan-card">
          <div className="skeleton" style={{ height: 360 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="plans">
      {plans.map((p) => {
        const isFeatured = p.slug === featuredSlug;
        return (
          <div
            key={p.id ?? p.slug}
            className={`plan-card${isFeatured ? ' featured' : ''}`}
            data-spotlight
            data-glare
          >
            {isFeatured && <div className="tag">Mais escolhido</div>}
            <div className="name">{p.name}</div>
            <div className="price">
              {brl(p.price)}
              <small>{priceSuffix}</small>
            </div>
            <div className="desc">{p.description || ''}</div>
            <ul>
              {(p.features || []).map((f) => (
                <li key={f}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" />
                  </svg>
                  {featureLabel(f, longLabels)}
                </li>
              ))}
            </ul>
            <Link
              to={`/checkout?plan=${p.slug}`}
              className={`btn ${isFeatured ? 'btn-primary' : 'btn-ghost'} btn-block`}
              data-magnet="16"
            >
              Assinar
            </Link>
          </div>
        );
      })}
    </div>
  );
}
