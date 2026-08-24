#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сменить пароль на кнопку «Сохранить для всех» в панели настроек 3D-сцены.

    python3 _tools/scene-pass.py

Спрашивает новый пароль (ввод не виден и не попадает в историю команд) и переписывает
site/api/scene-pass.php. В файл уходит только соль и отпечаток PBKDF2-SHA256 —
самого пароля в репозитории нет, восстановить его из отпечатка нельзя.
После смены нужен деплой: пароль проверяет php НА СЕРВЕРЕ.
"""
import binascii
import getpass
import hashlib
import io
import os
import sys

ITER = 200000
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'api', 'scene-pass.php')

TPL = u'''<?php
/**
 * Пароль на кнопку «Сохранить для всех» в панели настроек 3D-сцены.
 *
 * Здесь ТОЛЬКО соль и отпечаток PBKDF2-SHA256 (%(iter)d итераций) — самого пароля
 * в репозитории нет, как и у закрытых презентаций /ball/ и /avtovaz/.
 * Сменить пароль: python3 _tools/scene-pass.py (спросит новый и перепишет этот файл).
 */
return array(
  'salt' => '%(salt)s',
  'hash' => '%(hash)s',
  'iter' => %(iter)d,
);
'''


def main():
    p1 = getpass.getpass('Новый пароль: ')
    if len(p1) < 6:
        sys.exit('Слишком короткий пароль — минимум 6 знаков.')
    if p1 != getpass.getpass('Ещё раз: '):
        sys.exit('Пароли не совпали, файл не тронут.')
    salt = binascii.hexlify(os.urandom(16)).decode('ascii')
    h = hashlib.pbkdf2_hmac('sha256', p1.encode('utf-8'), salt.encode('ascii'), ITER).hex()
    with io.open(DST, 'w', encoding='utf-8') as f:
        f.write(TPL % {'salt': salt, 'hash': h, 'iter': ITER})
    print(u'Готово: %s' % os.path.normpath(DST))
    print(u'Теперь ./deploy.sh "новый пароль панели сцены" — иначе на сайте останется прежний.')


if __name__ == '__main__':
    main()
