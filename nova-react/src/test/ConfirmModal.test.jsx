import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from '../components/ConfirmModal';

describe('ConfirmModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <ConfirmModal open={false} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title and message when open', () => {
    render(
      <ConfirmModal
        open={true}
        title="Supprimer ?"
        message="Cet element sera supprime."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('Supprimer ?')).toBeInTheDocument();
    expect(screen.getByText('Cet element sera supprime.')).toBeInTheDocument();
  });

  it('calls onCancel when Annuler is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal open={true} onConfirm={() => {}} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByText('Annuler'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Supprimer is clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal open={true} onConfirm={onConfirm} onCancel={() => {}} />
    );
    fireEvent.click(screen.getByText('Supprimer'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses custom button text', () => {
    render(
      <ConfirmModal
        open={true}
        confirmText="Oui"
        cancelText="Non"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText('Non')).toBeInTheDocument();
    expect(screen.getByText('Oui')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal open={true} onConfirm={() => {}} onCancel={onCancel} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
