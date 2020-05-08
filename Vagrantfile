# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = 'ubuntu/trusty64'
  config.vm.network 'private_network', ip: '192.168.188.110'
  config.vm.synced_folder './', '/project'
  config.vm.provider 'virtualbox' do |vb|
    vb.name = 'docker-compose-vm'
    vb.memory = 2048
    vb.cpus = 1
  end
  config.vm.provision :shell, inline: %(
    if ! which docker >> /dev/null; then
      sudo apt install docker-ce=18.06.1~ce~3-0~ubuntu
    fi
    if ! which docker-compose >> /dev/null; then
      sudo curl -L "https://github.com/docker/compose/releases/download/1.23.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
      sudo chmod +x /usr/local/bin/docker-compose
    fi
  )
end