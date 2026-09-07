<?php
/**
 * Пароль кнопки «Для всех…» в панели настроек страницы POEMIQ.
 * Здесь ТОЛЬКО соль и отпечаток PBKDF2-SHA256 (200 000 итераций) — самого пароля в репозитории нет.
 * Сменить: python3 -c "import hashlib,binascii,os;s=binascii.hexlify(os.urandom(16)).decode();print(s, hashlib.pbkdf2_hmac('sha256', b'НОВЫЙ', s.encode(), 200000).hex())"
 * и переписать salt/hash ниже, затем деплой.
 */
return array(
  'salt' => '9517a110310cf1d8a37f0d6fcd1647bf',
  'hash' => '2879543674d3e396e02b06dc88f7f1971df703f7ba3545e8210ec2c3106aa911',
  'iter' => 200000,
);
