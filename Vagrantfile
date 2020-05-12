# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = 'ubuntu/trusty64'
  config.vm.network 'private_network', ip: '192.168.188.110'
  config.vm.synced_folder './', '/project'
  config.vm.provider 'virtualbox' do |vb|
    vb.name = 'open-cc-docker'
    vb.memory = 2048
    vb.cpus = 1
  end
  config.vm.provision :shell, inline: %(
    if ! which docker >> /dev/null; then
      sudo apt install apt-transport-https ca-certificates curl software-properties-common
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
      sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu trusty stable"
      sudo apt-get update
      sudo apt-get -y install docker-ce=18.06.1~ce~3-0~ubuntu
      sudo usermod -aG docker vagrant
    fi
    if ! which docker-compose >> /dev/null; then
      sudo curl -L "https://github.com/docker/compose/releases/download/1.25.5/docker-compose-Linux-x86_64" -o /usr/local/bin/docker-compose
      sudo chmod +x /usr/local/bin/docker-compose
    fi
  )
end