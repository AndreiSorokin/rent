'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Pavilion } from '@/types/store'; // предполагаемый тип

export default function PavilionPage() {
  const params = useParams();
  const storeId = Number(params.storeId);
  const pavilionId = Number(params.pavilionId);
  const [pavilion, setPavilion] = useState<Pavilion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Pavilion>(`/stores/${storeId}/pavilions/${pavilionId}`)
      .then(setPavilion)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storeId, pavilionId]);

  if (loading) return <div className="p-6 text-center">Загрузка...</div>;
  if (!pavilion) return <div className="p-6 text-center text-red-600">Павильон не найден</div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-center md:text-left">Павильон {pavilion.number}</h1>

      <div className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Информация о павильоне</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>Площадь:</strong> {pavilion.squareMeters} м²</p>
          <p><strong>Цена за м²:</strong> {pavilion.pricePerSqM}$</p>
          <p><strong>Статус:</strong> {pavilion.status}</p>
          <p><strong>Арендатор:</strong> {pavilion.tenantName || 'Нет'}</p>
          {/* Добавьте другие поля */}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Платежи</h2>
        {/* Список платежей – используйте таблицу */}
        <table className="w-full border-collapse">
          <thead>
            <tr><th>Период</th><th>Ожидаемо</th><th>Оплачено</th><th>Баланс</th></tr>
          </thead>
          <tbody>
            {pavilion.payments.map((pay) => (
              <tr key={pay.id}>
                <td>{pay.period}</td>
                <td>{pay.expectedTotal}</td>
                <td>{pay.paidTotal}</td>
                <td>{pay.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Дополнительные начисления</h2>
        {/* Список начислений */}
        <ul className="list-disc pl-5">
          {pavilion.additionalCharges.map((charge) => (
            <li key={charge.id}>{charge.name}: {charge.amount}$</li>
          ))}
        </ul>
      </div>
    </div>
  );
}